/**
 * @filename mapTrack.js
 * @authors remy
 * @creatTime 2017-09-30 11:56:54
 * @description 基于openLayers的地图轨迹播放组件
 * @updateTime 2017-10-20 17:35:59 v0.1.0 增加地图切换时的坐标转换transformMap
 * @version 0.1.0
 */

import {
  util,
  formatCoordSystem,
  transformCoord,
  ol,
  wgs84Sphere,
  mapSources,
  getLogoElement,
  getControls,
  addControl,
  icons
} from './base.js';

// mapTool，对内使用'EPSG:3857'，入口在各个初始化函数和setCoordinate方法;
// 对外使用'EPSG:4326'，出口在getCoordinate方法;
// 'EPSG:4326'--WGS84原始坐标系，瓦片大小是512×512；
// 'EPSG:3857'--Web Mercator，是google领头推动的一套标准，瓦片大小是256×256
// 'EPSG:3857'是根据赤道长度及经纬度计算出来的。
// 地球长轴为6378137米，赤道长度为2×6378137×π≈40075016.686米，则赤道上1°≈111319.491米。
// 假设某点的经纬度坐标为(63.767584,36.747445)，则将display unit换成meter后其坐标就是(7098574.996427,4090706.892127)，自己验证一下。
function from4326To3857(coordinate) {
  return ol.proj.transform(coordinate, 'EPSG:4326', 'EPSG:3857')
}

function from3857To4326(coordinate) {
  return ol.proj.transform(coordinate, 'EPSG:3857', 'EPSG:4326')
}

function compare(a, b) {
  return a - b;
}

// 轨迹默认样式
const defaultStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: [40, 172, 255, 0.15]
  }),
  stroke: new ol.style.Stroke({
    color: [40, 172, 255, 1],
    width: 2
  })
});

// 默认配置
const defaultSetting = {
  defaultMapCenter: from4326To3857([104.06584974378, 30.65754338153]), // 地图默认中心点--成都天府广场1、2号线地铁交汇点
  timerCallback: null, // timer每步后的回调，现用于同步更新页面播放控制器
  mapType: 'google',
  lngField: 'lng', // 坐标经度的字段名
  latField: 'lat', // 坐标纬度的字段名
  // 边界
  extent: null,
  // 默认边界[-180, -90, 180, 90]
  defaultExtent: ol.proj.transformExtent([-180, -90, 180, 90], 'EPSG:4326', 'EPSG:3857'),
  defaultZoom: 12,
  minZoom: 3,
  maxZoom: 21,
  maxZoom_baidu: 18,
  logoHref: 'https://www.cmfun.cn',
  logoImgSrc: '../favicon.ico',
  // 内置控件
  attribution: false, // 右下角的地图信息控件
  rotate: false, // 指北针控件
  zoom: false,
  fullScreen: true,
  mousePosition: true, // 鼠标当前坐标信息控件
  scaleLine: false, // 比例尺控件
  overviewMap: false, // 缩略图控件
  zoomSlider: false, // 缩放滚动条控件
  zoomToExtent: false, // 缩放到范围控件
  // 自定义控件
  selectMap: true // 地图切换控件
}

const moverImgs = {
  bd: [
    icons.bd_normalGeoImg,
    icons.bd_man_normalGeoImg,
    icons.bd_car_normalGeoImg,
    icons.bd_ship_normalGeoImg,
    icons.bd_aircraft_normalGeoImg
  ],
  net: [
    icons.net_normalGeoImg,
    icons.net_man_normalGeoImg,
    icons.net_car_normalGeoImg,
    icons.net_ship_normalGeoImg,
    icons.net_aircraft_normalGeoImg
  ]
}

/*
 * 移动物体类（如北斗卡）
 */
function Mover(type, showType) {
  this.icon = null;
  this.type = type || 'bd';
  this.showType = showType || 0; // 0：默认；1：终端设备；2：人；3：车；4：船；5：飞机
  this.coordinate = null;
  this.feature = null;
  // coordinate && this.init(coordinate);
}
Mover.prototype = {
  init(coordinate) {
    this.coordinate = util.isArray(coordinate) ? coordinate : [];
    this.feature = new ol.Feature({
      geometry: new ol.geom.Point(coordinate)
    });
    this.feature.setStyle(new ol.style.Style({
      image: new ol.style.Icon({
        src: moverImgs[this.type][this.showType],
        offset: [0, 28]
      })
    }));
  },
  setType(type, showType) {
    this.type = type;
    this.showType = showType;
    this.feature.getStyle().setImage(new ol.style.Icon({
      src: moverImgs[type][showType],
      offset: [0, 28]
    }));
  },
  update(coordinate) {
    if (coordinate[0] != this.coordinate[0] || coordinate[1] != this.coordinate[1]) {
      this.coordinate = coordinate;
      this.feature.getGeometry().setCoordinates(coordinate);
    }
  }
}

/*
 * 时间轴类，播放控制器
 */
function TimeLine(mover, maxSpace) {
  // 未初始化unInit；已初始化inited；停止stopped；播放playing；暂停paused；结束ended；默认unInit；
  this.state = 'unInit';
  this.pois = null;
  this.mover = mover;
  this.maxSpace = maxSpace; // 单位毫秒，两个定位点时间间隔的最大值，超出则分割成两段
  this.timer = 1000 / 60; // 频度，播放速度(单位毫秒)，默认1秒60帧
  this.step = 0.5 / 4; // 距离作为步长，单位米
  this.defaultStep = 0.5 / 4; // 默认步长（距离）
  this.step2 = 256; // 时间作为步长，单位毫秒，mover每移动一次所跨过的时间长度
  this.defaultStep2 = 256; // 默认步长（时间）
  this.timerCallback = null; // timer每步后的回调
  this.player = null; // 定时器
  this.currentIndex = ''; // 当前处于的轨迹点在pois中的索引
  this.currentTime = ''; // mover当前处于时间轴位置点的时间戳
  this.startTime = '';
  this.endTime = '';
}

TimeLine.prototype = {
  init(pois, timerCallback) {
    this.pois = pois;
    this.timerCallback = timerCallback;
    this.currentIndex = 0;
    this.currentTime = pois[0][2];
    this.startTime = pois[0][2];
    this.endTime = pois[pois.length - 1][2];
    this.state = 'inited';
  },
  // 计算当前时刻mover应该处于位置的坐标, 用于fromAToB2
  calculatePosition() {
    var startCoordX = this.pois[this.currentIndex][0],
      startCoordY = this.pois[this.currentIndex][1],
      endCoordX = this.pois[this.currentIndex + 1][0],
      endCoordY = this.pois[this.currentIndex + 1][1],
      totalTime = this.pois[this.currentIndex + 1][2] - this.pois[this.currentIndex][2],
      finishedTime = this.currentTime - this.pois[this.currentIndex][2];
    var finishedX = (endCoordX - startCoordX) * finishedTime / totalTime,
      finishedY = (endCoordY - startCoordY) * finishedTime / totalTime;
    return [startCoordX + finishedX, startCoordY + finishedY];
  },
  // 时间作为步长，根据两点间的距离和时间间隔计算速度
  fromAToB2() {
    var space = this.pois[this.currentIndex + 1][2] - this.pois[this.currentIndex][2];
    var steps = space / this.step2,
      isOverMax = space > this.maxSpace,
      coordinate = [this.pois[this.currentIndex][0], this.pois[this.currentIndex][1]];
    this.mover.update(coordinate);
    var _nowIndex = this.currentIndex; // 本次移动的索引
    this.player = setInterval(() => {
      if (steps > 0) {
        if (this.state == 'playing') {
          if (!isOverMax) {
            this.currentIndex = this.binarySearch(); // 确定当前时刻所属的定位点的所有
            if (this.currentIndex !== _nowIndex) {
              // 不属于本次移动的索引则清除本次移动的定时器，开始新的索引移动
              clearInterval(this.player);
              this.player = null;
              if (this.currentIndex == this.pois.length - 1) {
                this.state = 'stopped';
                this.timerCallback(this);
              } else {
                this.fromAToB2();
              }
              return;
            }
            // 计算当前时刻mover应该处于位置的坐标
            var currentCoord = this.calculatePosition();
            var currentX = currentCoord[0],
              currentY = currentCoord[1];
            steps = (this.pois[this.currentIndex + 1][2] - this.currentTime) / this.step2;
            var stepX = (this.pois[this.currentIndex + 1][0] - currentX) / steps,
              stepY = (this.pois[this.currentIndex + 1][1] - currentY) / steps;
            this.mover.update([currentX + stepX, currentY + stepY]);
            this.currentTime += this.step2;
          } else {
            // 两段轨迹间时，自动加速为defaultStep的128倍
            steps = (this.pois[this.currentIndex + 1][2] - this.currentTime) / this.defaultStep2 * 128;
            this.currentTime += this.defaultStep2 * 128;
          }
          steps--;
          this.timerCallback(this);
        }
      } else {
        clearInterval(this.player);
        this.player = null;
        if (this.currentIndex + 1 < this.pois.length - 1) {
          this.currentIndex++;
          this.fromAToB2();
        } else {
          this.state = 'stopped';
          this.timerCallback(this);
        }
      }
    }, this.timer);
  },
  // 固定的速度(距离)作为步长
  fromAToB() {
    var space = this.pois[this.currentIndex + 1][2] - this.pois[this.currentIndex][2],
      distance = wgs84Sphere.haversineDistance([this.pois[this.currentIndex][0], this.pois[this.currentIndex][1]], [this.pois[this.currentIndex + 1][0], this.pois[this.currentIndex + 1][1]]);
    var steps = distance / this.step,
      isOverMax = space > this.maxSpace;
    var coordinate = [this.pois[this.currentIndex][0], this.pois[this.currentIndex][1]];
    this.mover.update(coordinate);
    this.player = setInterval(() => {
      if (steps > 0) {
        if (this.state == 'playing') {
          if (!isOverMax) {
            var currentX = this.mover.coordinate[0],
              currentY = this.mover.coordinate[1];
            distance = wgs84Sphere.haversineDistance([currentX, currentY], [this.pois[this.currentIndex + 1][0], this.pois[this.currentIndex + 1][1]]);;
            steps = distance / this.step;
            var stepX = (this.pois[this.currentIndex + 1][0] - currentX) / steps,
              stepY = (this.pois[this.currentIndex + 1][1] - currentY) / steps;
            this.mover.update([currentX + stepX, currentY + stepY]);
          }
          var stepT = (this.pois[this.currentIndex + 1][2] - this.currentTime) / steps;
          this.currentTime = Math.floor(this.currentTime + stepT);
          steps--;
          this.timerCallback(this);
        }
      } else {
        clearInterval(this.player);
        this.player = null;
        if (this.currentIndex + 1 < this.pois.length - 1) {
          this.currentIndex++;
          this.fromAToB();
        } else {
          this.state = 'stopped';
          this.timerCallback(this);
        }
      }
    }, this.timer);
  },
  // 加速2*、4*、8*、16*、32*
  speedUp() {
    if (this.step / this.defaultStep < 32) {
      this.step = this.step * 2;
      this.step2 = this.step2 * 2;
    }
    var scale = this.step / this.defaultStep;
    return scale >= 1 ? scale : ('1/' + this.defaultStep / this.step);
  },
  // 减速2*、4*、8*、16*、32*
  speedDown() {
    if (this.step / this.defaultStep > 1 / 32) {
      this.step = this.step / 2;
      this.step2 = this.step2 / 2;
    }
    var scale = this.step / this.defaultStep;
    return scale >= 1 ? scale : ('1/' + this.defaultStep / this.step);
  },
  // 后退，仅用于fromAToB2
  backAway() {
    var targetTime = this.currentTime - Math.floor(this.step2 * 40 * this.timer);
    // 确保不小于起点时间
    this.currentTime = Math.max(this.pois[0][2], targetTime);
  },
  // 快进，仅用于fromAToB2
  fastForward() {
    var targetTime = this.currentTime + Math.floor(this.step2 * 40 * this.timer);
    // 确保不大于起点时间
    this.currentTime = Math.min(this.pois[this.pois.length - 1][2], targetTime);
  },
  // 二分查询当前时间所属点(当前所属点即fromAToB中的A点)
  binarySearch(s, e) {
    var targetTime = this.currentTime,
      result;
    var startIndex = s || 0,
      endIndex = e || (this.pois.length - 1);
    var middleIndex = Math.floor((startIndex + endIndex) / 2),
      sortTag = this.pois[startIndex][2] <= this.pois[endIndex][2]; // 确定排序顺序，true升序；false降序
    function getJudge(argument) {
      if (startIndex < endIndex) {
        if (middleIndex === 0) {
          result = middleIndex;
          return false;
        } else if (this.pois[middleIndex - 1][2] == targetTime) {
          result = middleIndex - 1;
          return false;
        } else if (this.pois[middleIndex - 1][2] < targetTime && targetTime <= this.pois[middleIndex][2]) {
          result = middleIndex - 1;
          return false;
        } else if (this.pois[middleIndex][2] < targetTime && targetTime <= this.pois[middleIndex + 1][2]) {
          result = middleIndex;
          return false;
        }
        return true;
      } else {
        result = endIndex;
        return false;
      }
    }
    while (getJudge.bind(this)()) {
      if (this.pois[middleIndex][2] > targetTime) {
        startIndex = startIndex;
        endIndex = middleIndex - 1;
      } else {
        startIndex = middleIndex + 1;
        endIndex = endIndex;
      }
      middleIndex = Math.floor((startIndex + endIndex) / 2);
    }

    return result;
  },
  start() {
    // 步长设为默认步长
    this.step = this.defaultStep;
    this.step2 = this.defaultStep2;
    this.fromAToB2();
    this.state = 'playing';
  },
  // 播放
  play() {
    if (this.state == 'inited') {
      this.start();
    } else if (this.state == 'stopped') {
      this.restart();
    } else {
      this.state = 'playing';
    }
  },
  // 暂停
  pause() {
    if (this.state == 'playing') this.state = 'paused';
  },
  stop() {
    this.player && clearInterval(this.player);
    this.mover.update([this.pois[0][0], this.pois[0][1]]);
    this.state = 'stopped';
  },
  restart() {
    this.stop();
    // 步长重置为默认步长
    this.step = this.defaultStep;
    this.step2 = this.defaultStep2;
    this.currentIndex = 0;
    this.currentTime = this.pois[0][2];
    this.start();
  },
}

/*
 * 历史轨迹类
 */
function Track(mapType, data) {
  this.mapType = mapType; // 地图源类型
  this.type = data.type || 'bd'; // 轨迹所属类型: bd; RN等，默认bd
  this.No = ''; // 轨迹数据源在数据库中的唯一编号
  this.id = ''; // 轨迹在本组件中的唯一id(type + '_' + No)
  // 轨迹点集合[[104,30,1502380680,"2017-08-10 23:58:00",2]](其中轨迹点的最后一个元素是坐标系,原始坐标存在5、6)
  this.pois = [];
  this.maxSpace = 30 * 60 * 1000; // 单位毫秒，两个定位点时间间隔的最大值，超出则分割成两段，默认30分钟
  this.segments = []; // 轨迹中所有段的起点、终点的集合[[起点1, 终点1],[起点2, 终点2]]
  this.features = []; // 轨迹段的feature的集合
  this.labels = []; // 轨迹的所有标注信息
  this.actived = false; // 是否激活Boolean，即是否添加到trackLayer图层中
  // 未初始化unInit；已初始化inited；已启动started；默认unInit；
  this.state = 'unInit';
  this.mover = new Mover(this.type, data && data.showType); // 发生轨迹的主体
  this.timeLine = new TimeLine(this.mover, this.maxSpace); // 时间轴
  if (data && data.pois) {
    this.init(data);
  }
}
Track.prototype = {
  init(data) {
    if (data && data.pois) {
      if (!util.isArray(data.pois)) throw new Error('mapTrack中Track.init()入参data.pois必须是Array型');
      if (data.No) {
        this.No = data.No;
      } else {
        throw new Error('mapTrack中Track.init()入参data缺少属性唯一编号No');
      }
      this.id = this.type + '_' + this.No;
      this.pois = data.pois;
      this.sort();
      this.draw();
      this.mover.init([data.pois[0][0], data.pois[0][1]]);
      this.state = 'inited';
    }
  },
  // 排序，将数据源数组按照定位时间先后顺序排正序
  sort() {
    if (this.pois[0][2] < this.pois[this.pois.length - 1][2]) return;

    function compare(a, b) {
      return a[2] - b[2];
    }
    this.pois.sort(compare);
  },
  // 绘制轨迹即创建轨迹的feature
  draw() {
    var parts = [];
    // 遍历轨迹数据源，提取所需信息
    this.pois.forEach((item, i, arr) => {
      // 将原始坐标存在item的5、6位置
      item[5] = item[0];
      item[6] = item[1];
      // 如果数据源中有坐标系，则根据坐标系转换坐标
      if (/^[0-9]$/.test(String(item[4]))) {
        var _coordinate = transformCoord([item[0], item[1]], item[4], this.mapType);
        this.pois[i][0] = item[0] = _coordinate[0];
        this.pois[i][1] = item[1] = _coordinate[1];
      }
      // 从EPSG:4326转成EPSG:3857
      var __coord = from4326To3857(item.slice(0, 2));
      item[0] = __coord[0];
      item[1] = __coord[1];
      // 将时间戳统一成标准长度
      this.pois[i][2] = ('' + item[2]).length === 10 ? item[2] * 1000 : item[2];
      // 分析包含的段
      if (i == 0) {
        this.segments[0] = [item];
        parts[0] = [];
        parts[0].push([item[0], item[1]]);
      } else if (item[2] - arr[i - 1][2] > this.maxSpace) {
        this.segments[this.segments.length - 1][1] = arr[i - 1];
        this.segments[this.segments.length] = [item];
        parts[parts.length] = [
          [item[0], item[1]]
        ];
      } else {
        if (arr.length - 1 == i) {
          this.segments[this.segments.length - 1][1] = item;
        }
        parts[parts.length - 1].push([item[0], item[1]]);
      }
    });
    // 按段绘制轨迹
    parts.forEach((coordinates, i, arr) => {
      var geometry = new ol.geom.LineString(coordinates, ol.geom.GeometryLayout.XY);
      var feature = new ol.Feature(geometry);
      feature.setStyle(defaultStyle);
      this.features.push(feature);
    });
    this.drawTip();
  },
  // 绘制轨迹的起点终点和标识1、2、3段（两点间定位时间超过this.maxSpace分钟的分割成两段）
  drawTip() {
    if (this.segments.length == 1) {
      // 起点
      var first = this.pois[0];
      this.drawLabel([first[0], first[1]], '起点');
      // 终点
      var last = this.pois[this.pois.length - 1];
      this.drawLabel([last[0], last[1]], '终点', 'red');
    } else {
      // 标识段;
      this.segments.forEach((segment, i, arr) => {
        this.drawLabel(segment[0], i + 1, 'number');
        this.drawLabel(segment[1], i + 1, 'red number');
      });
    }
  },
  /*
   * @param center { Coordinate }
   * @param txt { String }
   * @param className { String }
   * @description 绘制标注点形状的label
   */
  drawLabel(center, txt, className) {
    var elem = document.createElement('div');
    elem.textContent = txt;
    elem.className = 'trackLabel ' + (className || '');
    var label = new ol.Overlay({
      element: elem,
      position: center
    });
    this.labels.push(label);
  },
  // 启动播放
  startUp(timerCallback) {
    this.timeLine.init(this.pois, timerCallback);
    this.state = 'started';
  },
  destroy() {
    this.pois = null;
    this.segments = null;
    this.features = null;
    this.labels = null;
    this.mover = null;
    this.timeLine = null;
  }
}

/**
 * 实时轨迹类
 */
function RTTrack(mapTrack, id) {
  if (!id && util.isString(id)) throw new Error('mapTrack中new RTTrack(mapTrack, id)缺少入参No(String)');
  if (id.indexOf('_') > -1) {
    var _temp = id.split('_');
    this.type = _temp[0];
    this.No = _temp[1];
    this.id = id;
  } else {
    this.type = 'bd'; // 轨迹所属类型: bd; RN等，默认bd
    this.No = id; // 轨迹数据源在数据库中的唯一编号
    this.id = this.type + '_' + this.No; // 轨迹在本组件中的唯一id(type + '_' + No)
  }
  this.mapTrack = mapTrack;
  this.lngField = this.mapTrack.opts.lngField;
  this.latField = this.mapTrack.opts.latField;
  // 轨迹点集合[[104,30,1502380680,"2017-08-10 23:58:00",2]](其中轨迹点的最后一个元素是坐标系,原始坐标存在5、6)
  this.pois = [];
  // mover移动时临时存放已有轨迹点和移动轨迹点的集合
  this.current_pois = [];
  this.feature = null; // 轨迹段的feature的集合
  this.labels = []; // 轨迹的所有标注信息
  this.actived = false; // 是否激活Boolean，即是否添加到trackLayer图层中
  // 未初始化unInit；已初始化inited；移动中moving；暂停paused；完成移动ended；默认unInit；
  this.state = 'unInit';
  this.mover = new Mover(); // 发生轨迹的主体
  this.connection = null; // 请求的连接
}
RTTrack.prototype = {
  init(arr) {
    arr = arr || [];
    if (!util.isArray(arr)) arr = [arr];
    var coordinates = [];
    arr.forEach((data, i, array) => {
      if (data.posInfo) {
        var coordinate = [],
          originX = data.posInfo[this.lngField],
          originY = data.posInfo[this.latField];
        // 将原始坐标存放在coordinate的5、6位置
        coordinate[5] = originX;
        coordinate[6] = originY;
        if (data.posInfo.coordinateSystem) {
          var _coordinate = transformCoord([originX, originY], data.posInfo.coordinateSystem, this.mapTrack.opts.mapType);
          coordinate[0] = _coordinate[0];
          coordinate[1] = _coordinate[1];
          // 将定位数据的坐标系存放在coordinate的4位置
          coordinate[4] = data.posInfo.coordinateSystem;
        } else {
          coordinate[0] = originX;
          coordinate[1] = originY;
        }
        // 从EPSG:4326转成EPSG:3857
        var __coord = from4326To3857(coordinate.slice(0, 2));
        coordinate[0] = __coord[0];
        coordinate[1] = __coord[1];
        if (i === array.length - 1) {
          data.posInfo && this.mover.init(coordinate);
          util.isNumber(data.posInfo.showType) && this.mover.setType(this.type, data.posInfo.showType);
        }
        coordinates.push(coordinate);
      }
    }, this);
    this.feature = new ol.Feature({
      geometry: new ol.geom.LineString(coordinates, ol.geom.GeometryLayout.XY)
    });
    this.feature.setStyle(defaultStyle);
    this.pois = coordinates;
    this.state = 'inited';
  },
  createConnect(callback) {
    // TODO 这个方法没有用
    return
    var webSocket = new WebSocket('ws://10.30.0.33/data-push-websocket');
    webSocket.onopen = (function() {
      console.log('webSocket opened')
    }).bind(this);
    webSocket.onmessage = (function(data) {
      console.log('webSocket msg' + data)
    }).bind(this);
    webSocket.onerror = (function() {
      console.log('webSocket error')
      var data = JSON.parse('{"code":"4","type":"142","posInfo":{"posCardCode":"455990","card":null,"userID":501,"user":null,"posTime":1506483779000,"coordinateSystem":2,"lng":104.04424726323334,"lat":30.631515822111055,"s":0,"o":145,"h":501,"deltaH":null,"updateFlag":true,"warningFlag":false,"alarmFlag":false,"safeFlag":false}}');
      util.isFunction(callback) && callback(data);
      console.log('webSocket msg' + data)
      if (this.pois.length === 0) {
        this.init(data);
        this.mapTrack.activeRTTrack(this.id);
      } else {
        this.update(data);
      }
      setTimeout(() => {
        var data = JSON.parse('{"code":"4","type":"142","posInfo":{"posCardCode":"455990","card":null,"userID":501,"user":null,"posTime":1506483799000,"coordinateSystem":2,"lng":104.05435726323334,"lat":30.631615822111055,"s":0,"o":145,"h":501,"deltaH":null,"updateFlag":true,"warningFlag":false,"alarmFlag":false,"safeFlag":false}}');
        callback(data);
        this.update(data);
        setTimeout(() => {
          var data = JSON.parse('{"code":"4","type":"142","posInfo":{"posCardCode":"455990","card":null,"userID":501,"user":null,"posTime":1506483799000,"coordinateSystem":2,"lng":104.06535726323334,"lat":30.651615822111055,"s":0,"o":145,"h":501,"deltaH":null,"updateFlag":true,"warningFlag":false,"alarmFlag":false,"safeFlag":false}}');
          callback(data);
          this.update(data);
          setTimeout(() => {
            var data = JSON.parse('{"code":"4","type":"142","posInfo":{"posCardCode":"455990","card":null,"userID":501,"user":null,"posTime":1506483799000,"coordinateSystem":2,"lng":104.08535726323334,"lat":30.681615822111055,"s":0,"o":145,"h":501,"deltaH":null,"updateFlag":true,"warningFlag":false,"alarmFlag":false,"safeFlag":false}}');
            callback(data);
            this.update(data);
          }, 45 * 1000)
        }, 45 * 1000)
      }, 10 * 1000)
    }).bind(this);
    webSocket.onclose = (function() {
      console.log('webSocket closed')
    }).bind(this);
    this.connection = webSocket;
  },
  continue () {
    this.state = 'moving';
  },
  pause() {
    this.state = 'paused';
  },
  update(data) {
    // 目前如果上次移动还未结束，则做丢弃处理
    if (this.state == 'moving') return;
    if (data.posInfo) {
      var coordinate = [],
        originX = data.posInfo[this.lngField],
        originY = data.posInfo[this.latField];
      // 将原始坐标存放在coordinate的5、6位置
      coordinate[5] = originX;
      coordinate[6] = originY;
      if (data.posInfo.coordinateSystem) {
        var _coordinate = transformCoord([originX, originY], data.posInfo.coordinateSystem, this.mapTrack.opts.mapType);
        coordinate[0] = _coordinate[0];
        coordinate[1] = _coordinate[1];
        // 将定位数据的坐标系存放在coordinate的4位置
        coordinate[4] = data.posInfo.coordinateSystem;
      } else {
        coordinate[0] = originX;
        coordinate[1] = originY;
      }
      // 从EPSG:4326转成EPSG:3857
      var __coord = from4326To3857(coordinate.slice(0, 2));
      coordinate[0] = __coord[0];
      coordinate[1] = __coord[1];
      // 已有轨迹的最后一个点
      var before = this.pois[this.pois.length - 1];
      // 如果新轨迹点和before完全一样的忽略
      if (coordinate[0] == before[0] && coordinate[1] == before[1]) return;

      // 根据当前地图视野的边界extent判断mover是否超出边界，如果超出则地图zoom缩小一级
      // var extent = this.mapTrack.map.getView().calculateExtent(this.mapTrack.map.getSize());

      // 根据已有轨迹点和新轨迹点适配地图视野
      var lngArr = [],
        latArr = [];
      this.pois.forEach((item, i, array) => {
        lngArr.push(item[0]);
        latArr.push(item[1]);
      });
      lngArr.push(coordinate[0]);
      latArr.push(coordinate[1]);
      lngArr.sort(compare);
      latArr.sort(compare);
      this.mapTrack.map.getView().fit([lngArr[0], latArr[0], lngArr[lngArr.length - 1], latArr[latArr.length - 1]]);
      // 计算mover沿x、y轴移动的步长，设定30秒内移动完, 频度为60帧
      var frame = 60;
      var time = 30 * frame;
      var stepX = (coordinate[0] - before[0]) / time,
        stepY = (coordinate[1] - before[1]) / time;
      this.current_pois = this.pois.slice(0);

      // 移动
      function move() {
        this.state = 'moving';
        setTimeout(() => {
          if (this.mover) {
            if (this.mover.coordinate[0] >= coordinate[0]) {
              this.state = 'ended';
              this.pois.push(coordinate);
              this.mover.update([coordinate[0], coordinate[1]]);
              this.feature.getGeometry().setCoordinates(this.pois);
            } else {
              if (this.state == 'moving') {
                var x = this.mover.coordinate[0] + stepX,
                  y = this.mover.coordinate[1] + stepY;
                this.current_pois.push([x, y]);
                this.feature.getGeometry().setCoordinates(this.current_pois);
                this.mover.update([x, y]);
              }
              move.bind(this)();
            }
          }
        }, 1000 / frame);
      }
      move.bind(this)();
    }
  },
  destroy() {
    this.pois = null;
    this.feature = null;
    this.labels = null;
    this.mover = null;
  }
}

function MapTrack(options) {
  if (!util.isObject(options)) options = {};
  // opts仅支持非引用类型的属性（Object.assign仅复制可枚举的属性，属性值是引用类型的，也只拷贝引用值）
  var opts = Object.assign({}, defaultSetting, options);
  this.opts = opts;
  this.ol = ol;
  this.mapContainer = null;
  this.map = null;
  // 地图图层
  this.mapLayer = null;
  // 轨迹图层
  this.trackLayer = new ol.layer.Vector({
    source: new ol.source.Vector()
  });
  // mover图层
  this.moverLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    zIndex: 3
  });
  this.tracks = {}; // 历史轨迹集合 { bd_122: Track }
  this.rtTracks = {}; // 实时轨迹集合 { bd_122: RTTrack }

  this.init(this.opts.mapContainer);
}

MapTrack.prototype = {
  init(mapContainer, sourceName) {
    if (!mapContainer || mapContainer.nodeType !== 1) {
      throw Error('MapTrack.init缺少入参mapContainer');
    }
    this.mapContainer = mapContainer;

    var _mapSource = '';
    if (mapSources[sourceName]) {
      _mapSource = mapSources[sourceName];
      this.opts.mapType = sourceName;
    } else {
      _mapSource = mapSources.google;
      this.opts.mapType = 'google';
    }

    this.mapLayer = new ol.layer.Tile({
      source: _mapSource
    });
    this.map = new ol.Map({
      logo: getLogoElement(this.opts),
      controls: ol.control.defaults({
        attribution: this.opts.attribution, //右下角的地图信息控件
        rotate: false, // 指北针控件
        zoom: false // 缩放按钮控件
      }).extend(getControls(this.opts)),
      interactions: ol.interaction.defaults(),
      layers: [
        this.mapLayer,
        this.trackLayer,
        this.moverLayer
      ],
      view: new ol.View({
        center: this.opts.defaultMapCenter,
        // projection: 'EPSG:3857',
        zoom: this.opts.defaultZoom,
        minZoom: this.opts.minZoom,
        maxZoom: this.opts.mapType == 'baidu' ? this.opts.maxZoom_baidu : this.opts.maxZoom,
        // 边界[minx, miny, maxx, maxy]
        extent: (() => {
          if (util.isArray(this.opts.extent) && this.opts.extent.length == 4) {
            return ol.proj.transformExtent(this.opts.extent, 'EPSG:4326', 'EPSG:3857');
          } else {
            return this.opts.defaultExtent;
          }
        })()
      }),
      target: this.mapContainer
    });
    this.opts.selectMap && this.addControl('selectMap');
  },
  addControl: addControl,
  // 转换地图上所有feature
  transformMap(oldMapType) {
    // 历史轨迹
    var isPlaying = this.timeLine && this.timeLine.state == 'playing';
    if (isPlaying) this.timeLine.pause();
    Object.keys(this.tracks).forEach((id) => {
      var track = this.tracks[id];
      var parts = [];
      // 遍历轨迹数据源，提取所需信息
      track.pois.forEach((item, i, arr) => {
        // 如果数据源中有坐标系，则根据坐标系转换坐标
        if (/^[0-9]$/.test(String(item[4]))) {
          var _coordinate = transformCoord([item[5], item[6]], item[4], this.opts.mapType);
          track.pois[i][0] = item[0] = _coordinate[0];
          track.pois[i][1] = item[1] = _coordinate[1];
        }
        // 从EPSG:4326转成EPSG:3857
        var __coord = from4326To3857(item.slice(0, 2));
        track.pois[i][0] = item[0] = __coord[0];
        track.pois[i][1] = item[1] = __coord[1];
        // 分析包含的段
        if (i == 0) {
          parts[0] = [];
          parts[0].push([item[0], item[1]]);
        } else if (item[2] - arr[i - 1][2] > track.maxSpace) {
          parts[parts.length] = [
            [item[0], item[1]]
          ];
        } else {
          parts[parts.length - 1].push([item[0], item[1]]);
        }
      });
      // 按段绘制轨迹
      track.features.forEach((feature, i, arr) => {
        feature.getGeometry().setCoordinates(parts[i]);
      });
      // mover
      track.mover.update(transformCoord(track.mover.coordinate, oldMapType, this.opts.mapType));
      // labels
      track.labels.forEach((overlay, i, arr) => {
        var coord = track.segments[Math.floor(i / 2)][i % 2];
        overlay.setPosition(transformCoord([coord[5], coord[6]], coord[4], this.opts.mapType));
      });
    }, this);
    if (isPlaying) this.timeLine.play();
    // 实时轨迹
    Object.keys(this.rtTracks).forEach((id) => {
      var rtTrack = this.rtTracks[id];
      if (rtTrack.pois.length === 0) return;
      var isMoving = rtTrack.state == 'moving';
      // 暂停移动
      isMoving && rtTrack.pause();
      rtTrack.current_pois = [];
      rtTrack.pois.forEach((poi, i, arr) => {
        if (/^[0-9]$/.test(String(poi[4]))) {
          var _coord = transformCoord([poi[5], poi[6]], poi[4], this.opts.mapType);
          rtTrack.pois[i][0] = _coord[0];
          rtTrack.pois[i][1] = _coord[1];
        }
        // 从EPSG:4326转成EPSG:3857
        var __coordinate = from4326To3857(poi.slice(0, 2));
        rtTrack.pois[i][0] = __coordinate[0];
        rtTrack.pois[i][1] = __coordinate[1];
        rtTrack.current_pois.push(__coordinate);
      });
      if (isMoving) {
        var currentCoord = transformCoord(rtTrack.mover.coordinate, oldMapType, this.opts.mapType);
        rtTrack.mover.update(currentCoord);
        rtTrack.current_pois.push(currentCoord);
      } else {
        rtTrack.mover.update(rtTrack.current_pois[rtTrack.current_pois.length - 1]);
      }
      rtTrack.feature.getGeometry().setCoordinates(rtTrack.current_pois);
      // 继续移动
      isMoving && rtTrack.continue();
    }, this);
  },
  setMapSource(sourceName) {
    if (this.opts.mapType == sourceName) return;
    var layers = this.map.getLayers(),
      _mapSource = null;
    if (mapSources[sourceName]) {
      _mapSource = mapSources[sourceName];
      this.opts.mapType = sourceName;
      this.mapLayer.setSource(_mapSource);
      this.map.getView().setMaxZoom(sourceName == 'baidu' ? this.opts.maxZoom_baidu : this.opts.maxZoom);
    }
  },
  // 根据当前激活的轨迹的最大边界适配地图可视区域
  // @param field: tracks、rtTracks; 默认tracks
  fitScreen(field) {
    field = field || 'tracks';

    var lngArr = [],
      latArr = [];
    Object.keys(this[field]).forEach((id, i, arr1) => {
      if (this[field][id].actived) {
        this[field][id].pois.forEach((item, j, arr2) => {
          lngArr.push(item[0]);
          latArr.push(item[1]);
        });
      }
    });
    lngArr.sort(compare);
    latArr.sort(compare);
    this.map.getView().fit([lngArr[0], latArr[0], lngArr[lngArr.length - 1], latArr[latArr.length - 1]]);
  },
  // 历史轨迹
  createTrack(data) {
    var track = new Track(this.opts.mapType, data);
    this.tracks[track.id] = track;
    return track;
  },
  // 将历史轨迹添加到图层
  activeTrack(id) {
    var track = this.tracks[id];
    track.actived = true;
    this.trackLayer.getSource().addFeatures(track.features);
    this.moverLayer.getSource().addFeature(track.mover.feature);
    track.labels.forEach((label, i, arr) => {
      this.map.addOverlay(label);
    });
    this.fitScreen();
    track.startUp(this.opts.timerCallback);
    this.timeLine = track.timeLine;
  },
  // 将历史轨迹从图层中移除
  removeTrack(id) {
    var track = this.tracks[id],
      source = this.trackLayer.getSource();
    track.timeLine.stop();
    track.actived = false;
    track.labels.forEach((label, i, arr) => {
      this.map.removeOverlay(label);
    });
    track.features.forEach((feature, i, arr) => {
      source.removeFeature(feature);
    });
    this.moverLayer.getSource().removeFeature(track.mover.feature);
  },
  removeAllTrack() {
    Object.keys(this.tracks).forEach((id, i, array) => {
      this.removeTrack(id);
    });
  },
  // 销毁历史轨迹
  destroyTrack(id) {
    if (this.tracks[id].actived) this.removeTrack(id);
    this.tracks[id].destroy();
    this.tracks[id] = null;
    delete this.tracks[id];
  },
  destroyAllTrack() {
    Object.keys(this.tracks).forEach((id, i, array) => {
      this.destroyTrack(id);
    });
  },
  // 实时轨迹
  createRTTrack(id) {
    var rtTrack = new RTTrack(this, id);
    this.rtTracks[rtTrack.id] = rtTrack;
    return rtTrack;
  },
  // 将实时轨迹添加到图层
  activeRTTrack(id) {
    var rtTrack = this.rtTracks[id];
    rtTrack.actived = true;
    this.trackLayer.getSource().addFeature(rtTrack.feature);
    this.moverLayer.getSource().addFeature(rtTrack.mover.feature);
    rtTrack.labels.forEach((label, i, arr) => {
      this.map.addOverlay(label);
    });
    this.fitScreen('rtTracks');
    // this.map.getView().setCenter(rtTrack.pois[0]);
    // this.map.getView().setZoom(15);
  },
  // 将实时轨迹从图层中移除
  removeRTTrack(id) {
    var rtTrack = this.rtTracks[id];
    rtTrack.actived = false;
    rtTrack.labels.forEach((label, i, arr) => {
      this.map.removeOverlay(label);
    });
    this.trackLayer.getSource().removeFeature(rtTrack.feature);
    this.moverLayer.getSource().removeFeature(rtTrack.mover.feature);
  },
  removeAllRTTrack() {
    Object.keys(this.rtTracks).forEach((id, i, array) => {
      this.removeRTTrack(id);
    });
  },
  // 销毁实时轨迹
  destroyRTTrack(id) {
    if (this.rtTracks[id].actived) this.removeRTTrack(id);
    this.rtTracks[id].destroy();
    this.rtTracks[id] = null;
    delete this.rtTracks[id];
  },
  destroyAllRTTrack() {
    Object.keys(this.rtTracks).forEach((id, i, array) => {
      this.destroyRTTrack(id);
    });
  },
  destroy() {
    Object.keys(this.rtTracks).forEach((id, i, array) => {
      this.destroyRTTrack(id);
    });
    Object.keys(this.tracks).forEach((id, i, array) => {
      this.destroyTrack(id);
    });
    this.opts = null;
    this.mapContainer = null;
    this.map = null;
    this.mapLayer = null;
    this.trackLayer = null;
    this.moverLayer = null;
  }
}

export default MapTrack;
