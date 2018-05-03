/**
 * @filename mapTool.js
 * @authors remy
 * @creatTime 2017-08-07 11:43:59
 * @description 基于openlayers4的常用工具模块封装
 * @updateTime 2017-09-27 10:35:59 v0.1.0 增加minZoom、maxZoom、extent默认配置
 * @updateTime 2017-09-29 17:35:59 v0.2.0 增加动态切换地图
 * @updateTime 2017-10-12 14:35:59 v0.3.0 增加百度与高德、谷歌的坐标转换坐标系transformMap
 * @updateTime 2018-01-12 10:35:59 v0.5.0 修正地图坐标系：'EPSG:4326'与'EPSG:3857'的转换
 * @updateTime 2018-01-15 19:35:59 v0.5.2 增加默认配置参数defaultInitMaxZoom
 * @version 0.5.2
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
function from4326To3857(coordinate){
  return ol.proj.transform(coordinate, 'EPSG:4326', 'EPSG:3857')
}
function from3857To4326(coordinate){
  return ol.proj.transform(coordinate, 'EPSG:3857', 'EPSG:4326')
}

// 添加、初始化自定义控件
function initControl(arr) {
  var me = this;
  util.forEach(arr, function(item, i) {
    if (me.opts[item.name]) {
      // 添加绘图交互drawInteraction
      var interaction = me.createDrawInteraction(item.type);

      me.addControl({
        className: item.name,
        text: item.text,
        onclick: function(event) {
          if (me.currentCtrl !== '') return; // 确保当前没有自定义控件处于激活状态
          me.currentCtrl = item.name; // 更新当前交互控件

          me.map.addInteraction(interaction);

          me.map.on('pointermove', me.pointerMoveHandler, me);
          me.map.getViewport().addEventListener('mouseout', me.mouseoutHandler.bind(me));
        }
      });
    }
  });
}

// 栅栏图形停用样式
const disabledStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: [136, 136, 136, 0.15]
  }),
  stroke: new ol.style.Stroke({
    color: [136, 136, 136, 1],
    width: 1
  })
});
// 栅栏图形启用样式
const enabledStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: [34, 142, 255, 0.15],
  }),
  stroke: new ol.style.Stroke({
    color: [34, 142, 255, 1],
    width: 1
  })
});
// 栅栏图形处于选中、编辑状态时的样式
const editingStyle = new ol.style.Style({
  fill: new ol.style.Fill({
    color: [136, 136, 136, 0.15]
  }),
  stroke: new ol.style.Stroke({
    color: [136, 136, 136, 1],
    lineDash: [10, 10],
    width: 2
  }),
  image: new ol.style.Circle({
    radius: 5,
    stroke: new ol.style.Stroke({
      color: 'rgba(0, 0, 0, 0.7)'
    }),
    fill: new ol.style.Fill({
      color: 'rgba(255, 255, 255, 0.2)'
    })
  })
});

// 默认配置
const _defaultSetting = {
  defaultMapCenter: from4326To3857([104.06584974378, 30.65754338153]), // 地图默认中心点--成都天府广场1、2号线地铁交汇点
  lngField: 'lng', // 坐标经度的字段名
  latField: 'lat', // 坐标纬度的字段名
  // 是否仅首次加载定位点时适配可视范围
  isOnlyFirstFitToAllGeos: true,
  // 地图feature的图标icon的缩放比例基于的缩放的默认层级
  iconScaleDefaultZoom: 12,
  // 边界
  extent: null,
  // 默认边界[-180, -90, 180, 90]
  defaultExtent: ol.proj.transformExtent([-180, -90, 180, 90], 'EPSG:4326', 'EPSG:3857'),
  defaultZoom: 12,
  // 初始化时fitToAllGeos适配的最大层级
  defaultInitMaxZoom: 17,
  minZoom: 3,
  maxZoom: 21,
  maxZoom_baidu: 18,
  bd_geoPointIdField: 'id',
  net_geoPointIdField: 'id',
  markerIdField: 'id',
  fenceIdField: 'id',
  logoHref: 'https://www.cmfun.cn',
  logoImgSrc: '../favicon.ico',
  showPolygon: false,
  LineString_maxPoints: 100,
  // 不同点数的pointData长度为{10: 410; 20: 789; 30: 1159; 40: 1524; 50: 1914}
  Polygon_maxPoints: 30,
  showFenceArea: false, // 是否显示电子围栏面积
  isListenScale: false, // 是否监听地图缩放，如图标跟随地图层级变化而变化
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
  // 自定义控件（需要手动设置自定义控件的样式）
  measure: false,
  mark: true,
  circle: true,
  polygon: true,
  square: true,
  rectangle: true,
  goHome: true, // 快速定位到最佳视角控件
  selectMap: true // 地图切换控件
}
const defaultSetting = Object.assign({}, _defaultSetting, icons);

// 定位点: id在数据源id的基础上加了‘bd_’/‘net_’的前缀(因为不同类型的定位点，id可能会重复)
function GeoPoint(layer, type, options) {
  this.id;
  this.opts = options;
  this.map = this.opts.map;
  this.type = type || 'bd'; // bd、net，默认bd
  // data中唯一属性id的字段名
  this.idField = this.opts[this.type + '_geoPointIdField'];
  this.data = null; // 数据源
  this.feature = null;
  this.layer = layer; // 在地图上所在的层
}
GeoPoint.prototype = {
  init(data) {
    this.data = data;
    this.data.type = this.type;
    this.updateId();
    this.feature = new ol.Feature({
      geometry: new ol.geom.Point(data.data)
    });
    this.feature.setStyle(new ol.style.Style({
      image: new ol.style.Icon({
        src: this.getImg(this.opts),
        // 设置图标的缩放率，基于层级iconScaleDefaultZoom来做缩放
        scale: this.opts.isListenScale ? this.map.getView().getZoom() / this.opts.iconScaleDefaultZoom : 1,
        offset: [0, 28]
      })
    }));
    this.feature.__type = 'geoPoint';
    this.feature.__geoPoint = this;
    this.layer.getSource().addFeature(this.feature);
    return this;
  },
  update(data) {
    if (!data) return this;
    this.data = data;
    this.data.type = this.type;
    this.updateId();
    this.setCoordinate(data.data, 'EPSG:3857');
    this.feature.setStyle(new ol.style.Style({
      image: new ol.style.Icon({
        src: this.getImg(this.opts),
        // 设置图标的缩放率，基于层级iconScaleDefaultZoom来做缩放
        scale: this.opts.isListenScale ? this.map.getView().getZoom() / this.opts.iconScaleDefaultZoom : 1,
        offset: [0, 28]
      })
    }));
    return this;
  },
  updateId(id) {
    this.id = this.type + '_' + (id || this.data[this.idField]);
    this.data[this.idField] = String(id || this.data[this.idField]);
  },
  setCoordinate(coordinate, projectionLink) {
    this.feature.getGeometry().setCoordinates(projectionLink === 'EPSG:3857' ? coordinate : from4326To3857(coordinate));
  },
  getCoordinate(projectionLink) {
    var coordinate = this.feature.getGeometry().getCoordinates();
    return projectionLink === 'EPSG:3857' ? coordinate : from3857To4326(coordinate);
  },
  // 获取定位点icon的图片
  getImg(opts) {
    var img = '';
    if (util.isFunction(opts.getGeoImg)) {
      img = opts.getGeoImg(this.data);
    } else {
      var showType;
      switch (this.data.showType) {
        case 1:
          showType = 'man_';
          break;
        case 2:
          showType = 'car_';
          break;
        case 3:
          showType = 'ship_';
          break;
        case 4:
          showType = 'aircraft_';
          break;
        default:
          showType = '';
          break;
      }
      var nowDate = new Date();
      var nowTime = new Date(nowDate.getFullYear() + '-' + (nowDate.getMonth() + 1) + '-' + nowDate.getDate());
      if (this.type == 'bd') {
        if (this.data.sosStatus) {
          img = opts['bd_' + showType + 'alarmGeoImg'];
        } else if (this.data.fenceAlarmStatus) {
          img = opts['bd_' + showType + 'warnGeoImg'];
        } else if (this.data.safeStatus && this.data.safeTime >= nowTime) {
          img = opts['bd_' + showType + 'safeGeoImg'];
        } else {
          img = opts['bd_' + showType + 'normalGeoImg'];
        }
      } else if (this.type == 'net') {
        if (this.data.fenceAlarmStatus) {
          img = opts['net_' + showType + 'warnGeoImg'];
        } else {
          img = opts['net_' + showType + 'normalGeoImg'];
        }
      }
    }
    return img;
  },
  openInfoWindow() {
    console.log('TODO');
  }
}

// 标注点: id在数据源id一致
function Marker(layer, options) {
  this.id;
  this.opts = options;
  this.map = this.opts.map;
  this.idField = this.opts.markerIdField; // data中唯一属性id的字段名
  this.data = null; // 数据源
  this.feature = null;
  this.layer = layer; // 在地图上所在的层
}
Marker.prototype = {
  init(data) {
    this.data = data;
    this.updateId();
    var originCoord = data.data || [1000, 1000];
    this.feature = new ol.Feature({
      geometry: new ol.geom.Point(originCoord)
    });
    this.feature.setStyle(new ol.style.Style({
      image: new ol.style.Icon({
        src: icons.markerImg,
        // 设置图标的缩放率，基于层级iconScaleDefaultZoom来做缩放
        scale: this.opts.isListenScale ? this.map.getView().getZoom() / this.opts.iconScaleDefaultZoom : 1,
        offset: [0, 14]
      })
    }));
    this.feature.__type = 'marker';
    this.feature.__marker = this;
    this.layer.getSource().addFeature(this.feature);
    return this;
  },
  update(data) {
    if (!data) return this;
    this.data = data;
    this.updateId();
    this.feature.getGeometry().setCoordinates(data.data);
    return this;
  },
  updateId(id) {
    this.id = id || this.data[this.idField];
    this.data[this.idField] = String(this.id);
    this.data.isSaved = this.data[this.idField].indexOf('add_') == -1;
  },
  setCoordinate(coordinate, projectionLink) {
    this.feature.getGeometry().setCoordinates(projectionLink === 'EPSG:3857' ? coordinate : from4326To3857(coordinate));
  },
  getCoordinate(projectionLink) {
    var coordinate = this.feature.getGeometry().getCoordinates();
    return projectionLink === 'EPSG:3857' ? coordinate : from3857To4326(coordinate);
  },
  destroy() {
    delete this.feature.__type;
    delete this.feature.__marker;
    this.layer.getSource().removeFeature(this.feature);
  }
}

// 电子围栏/栅栏: id在数据源id一致
function Fence(layer, options) {
  this.id;
  this.opts = options;
  this.map = this.opts.map;
  this.idField = this.opts.fenceIdField; // data中唯一属性id的字段名
  this.type = ''; // Square、Rectangle、Circle、Polygon
  this.data = null; // 数据源
  this.feature = null;
  this.center = null; // 图形的中心点
  this.tipCoord = null; // 承载提示框的坐标点
  this.areaTipOverlay = null; // 面积提示的overlay，仅当showFenceArea=true时有效
  this.layer = layer; // 在地图上所在的层
  // 图形编辑时的监听事件集(array)[{event: String, target: Object, handler: Function}]，
  // 移除电子围栏时需要将事件集中的事件全部解除监听
  this.modifyListeners = null;
}
Fence.prototype = {
  init(feature, data) {
    this.feature = feature;
    feature.__type = 'fence';
    feature.__fence = this;
    this.data = data;
    this.updateId();
    this.getGeometryType();
    this.updateCenter();
  },
  update(data) {
    if (!data) return this;
    this.data = data;
    this.updateId();
    this.updateCenter();
    return this;
  },
  updateCenter() {
    var pointCoord;
    if (this.type == 'circle') {
      pointCoord = this.feature.getGeometry().getCenter();
    } else {
      pointCoord = this.feature.getGeometry().getExtent();
      pointCoord = [(pointCoord[0] + pointCoord[2]) / 2, (pointCoord[1] + pointCoord[3]) / 2]
    }
    this.center = pointCoord;
  },
  updateId(id) {
    this.id = id || this.data[this.idField];
    this.data[this.idField] = String(this.id);
    this.data.isSaved = this.data[this.idField].indexOf('add_') == -1;
  },
  setStatus(state) {
    this.data.enabled = state;
    this.feature.setStyle(state ? enabledStyle : disabledStyle);
  },
  // 初始化feature的几何图形的类型
  getGeometryType() {
    var geom = this.feature.getGeometry();
    if (geom instanceof ol.geom.Circle) {
      this.type = 'Circle';
    } else if (geom instanceof ol.geom.Polygon) {
      this.type = 'Polygon';
    } else if (geom instanceof ol.geom.LineString) {
      this.type = 'LineString';
    }
    return this.type;
  },
  setCoordinates(coordinates, projectionLink) {
    if(util.isArray(coordinates)){
      if(projectionLink === 'EPSG:3857'){
        this.feature.getGeometry().setCoordinates(coordinates);
      }else{
        var coords = [];
        coordinates.forEach((coordinate) => {
          coords.push(from4326To3857(coordinate));
        });
        this.feature.getGeometry().setCoordinates([coords]);
      }
    }
  },
  getCoordinates(projectionLink) {
    var coordinates = this.feature.getGeometry().getCoordinates();
    if(projectionLink === 'EPSG:3857'){
      return coordinates;
    }else{
      var coords = [];
      coordinates[0].forEach((coordinate) => {
        coords.push(from3857To4326(coordinate));
      });
      return coords;
    }
  },
  setRadius(radius) {
    util.isNumber(radius) && this.feature.getGeometry().setRadius(radius);
  },
  getRadius() {
    return this.feature.getGeometry().getRadius();
  },
  setCenter(coordinate, projectionLink) {
    if(util.isArray(coordinate)){
      this.feature.getGeometry().setCenter(projectionLink === 'EPSG:3857' ? coordinate : from4326To3857(coordinate));
    }
  },
  getCenter(projectionLink) {
    var coordinate = this.feature.getGeometry().getCenter();
    return projectionLink === 'EPSG:3857' ? coordinate : from3857To4326(coordinate);
  },
  getPointData(projectionLink) {
    var pointData = '';
    if (this.type == 'Circle') {
      pointData = this.getCenter(projectionLink).toString() + '@' + this.getRadius();
    } else {
      this.getCoordinates(projectionLink).forEach((coordinate, i, array) => {
        pointData += (i === 0 ? '' : ';') + coordinate.toString();
      });
    }
    return pointData;
  },
  getToolTipObj() {
    var text = '',
      tipCoord = null,
      geom = this.feature.getGeometry();
    if (this.type == 'Circle') {
      text = this.formatArea();
      this.tipCoord = geom.getCenter();
    } else if (this.type == 'Polygon') {
      text = this.formatArea();
      this.tipCoord = geom.getInteriorPoint().getCoordinates();
    } else if (this.type == 'LineString') {
      text = this.formatLength(geom);
      this.tipCoord = geom.getLastCoordinate();
    }
    return { text: text, coord: this.tipCoord };
  },
  /**
   * Format length output.
   * @param {ol.geom.LineString} line The line.
   * @return {string} The formatted length.
   */
  formatLength(line) {
    var length,
      isGeodesic = true; // 是否计算投射到地球上面的实际距离
    if (isGeodesic) {
      var coordinates = line.getCoordinates();
      length = 0;
      var sourceProj = this.map.getView().getProjection();
      for (var i = 0, ii = coordinates.length - 1; i < ii; ++i) {
        var c1 = ol.proj.transform(coordinates[i], sourceProj, 'EPSG:4326');
        var c2 = ol.proj.transform(coordinates[i + 1], sourceProj, 'EPSG:4326');
        length += wgs84Sphere.haversineDistance(c1, c2);
      }
    } else {
      length = Math.round(line.getLength() * 100) / 100;
    }
    var output;
    if (length > 100) {
      output = (Math.round(length / 1000 * 100) / 100) +
        ' ' + 'km';
    } else {
      output = (Math.round(length * 100) / 100) +
        ' ' + 'm';
    }
    return output;
  },
  getArea() {
    var area,
      geom = this.feature.getGeometry(),
      isGeodesic = true; // 是否计算多边形投射到地球上面的近似区域面积
    var sourceProj = this.map.getView().getProjection();
    if (this.type == 'Circle') {
      if (isGeodesic) {
        var circle = /** @type {ol.geom.Circle} */ (geom.clone().transform(
          sourceProj, 'EPSG:4326'));
        var abovePoint = circle.getLastCoordinate();
        var centerPoint = circle.getFirstCoordinate();
        var radius = wgs84Sphere.haversineDistance(abovePoint, centerPoint);
        area = Math.PI * Math.pow(radius, 2);
      } else {
        area = Math.PI * Math.pow(circle.getRadius(), 2);
      }
    } else if (this.type == 'Polygon') {
      if (isGeodesic) {
        var polygon = /** @type {ol.geom.Polygon} */ (geom.clone().transform(
          sourceProj, 'EPSG:4326'));
        var coordinates = polygon.getLinearRing(0).getCoordinates();
        area = Math.abs(wgs84Sphere.geodesicArea(coordinates));
      } else {
        area = polygon.getArea();
      }
    }
    return area;
  },
  /**
   * Format area output.
   * @return {String} Formatted area.
   */
  formatArea() {
    var area = this.getArea();
    var output;
    if (area > 10000) {
      output = (Math.round(area / 1000000 * 100) / 100) +
        ' ' + 'km<sup>2</sup>';
    } else {
      output = (Math.round(area * 100) / 100) +
        ' ' + 'm<sup>2</sup>';
    }
    return output;
  },
  openInfoWindow() {
    console.log('TODO');
  },
  destroy() {
    delete this.feature.__type;
    delete this.feature.__fence;
    this.layer.getSource().removeFeature(this.feature);
  }
}

// 菜单
function Menu(type) {
  this.type = type; // geoPoint, marker, fence
  this.element = null;
  this.data = null; // 菜单数据
  this.menuItems = []; // 菜单项集
  this.target = null; // 菜单当前作用的对象geoPoint、marker、fence等
  this.overlay = null; // 承载菜单dom的地图覆盖物overlay
}
Menu.prototype = {
  init(map, arr) {
    this.data = arr;
    this.element = document.createElement('div');
    this.element.className = 'menu';
    for (var i = 0, len = this.data.length; i < len; i++) {
      var item = this.data[i];
      var menuItem = document.createElement('div');
      menuItem.className = 'menuItem' + (item.disabled ? ' disabled' : '');
      menuItem.textContent = item.text;
      menuItem.onclick = item.onclick.bind(menuItem);
      menuItem.menu = this;
      this.element.appendChild(menuItem);
      this.menuItems.push(menuItem);
    }
    this.overlay = new ol.Overlay({
      element: this.element
    });
    map.addOverlay(this.overlay);
  },
  getItem(i) {
    return this.menuItems[i];
  },
  setStatus(i, status) {
    var menuItem = this.menuItems[i];
    menuItem.className = menuItem.className.replace(/\sdisabled/, '') + (status ? '' : ' disabled');
    return this;
  },
  setText(i, text) {
    this.menuItems[i].textContent = text;
    return this;
  },
  // 设置菜单当前作用的对象
  setTarget(target) {
    this.target = target;
    // 根据target.data更新菜单
    // TODO
    return this;
  },
  show() {
    if (this.element && this.element.parentNode) this.element.parentNode.style.display = 'block';
    return this;
  },
  hide() {
    if (this.element && this.element.parentNode) this.element.parentNode.style.display = 'none';
    return this;
  }
}

// 信息窗
function InfoWindow(type) {
  this.type = type; // geoPoint, marker, fence
  this.element = null;
  this.data = null; // 信息窗数据
  this.target = null; // 信息窗当前作用的对象geoPoint、marker、fence等
  this.overlay = null; // 承载信息窗dom的地图覆盖物overlay
}
InfoWindow.prototype = {
  init(map, element, offset) {
    this.element = element;
    this.overlay = new ol.Overlay({
      element: this.element,
      offset: offset
    });
    map.addOverlay(this.overlay);
    return this;
  },
  // 设置菜单当前作用的对象
  setTarget(target) {
    this.target = target;
    return this;
  },
  show(coordinate) {
    if (util.isArray(coordinate) && coordinate.length == 2) {
      this.overlay.setPosition(coordinate);
    }
    if (this.element && this.element.parentNode) this.element.parentNode.style.display = 'block';
    return this;
  },
  hide() {
    if (this.element && this.element.parentNode) this.element.parentNode.style.display = 'none';
    return this;
  }
}

// 私有方法

// 处理标注事件
function handleMarkInteraction(event) {

  var marker = new Marker(this.markerLayer, this.opts);
  var _opts = {
    posCoordinateSystem: this.getCoordSystem(),
    remark: ''
  }
  _opts[this.opts.markerIdField] = 'add_' + (Object.keys(this.markers).length + 1);
  marker.init(_opts);

  function handler(event) {
    this.map.un('pointermove', update, this);
    this.map.un('pointerdown', handler, this);
    if (event.originalEvent.which == 3 || event.originalEvent.keyCode == 3) {
      marker.destroy();
      marker = null;
    } else if (event.originalEvent.which == 1 || event.originalEvent.keyCode == 1) {
      this.markers[marker.id] = marker;
    }
  }

  function update(event) {
    marker.feature.getGeometry().setCoordinates(event.coordinate);
  }
  this.map.on('pointerdown', handler, this);
  this.map.on('pointermove', update, this);
}
// 处理单击、双击地图选中feature的函数
function handlerSelected(event){
  const offset = getOffset.bind(this)();
  // 根据fence的数据源中的remarks长度占用的行数动态设置overlay的offset
  function setOffset(infoWindowType, str, infoWindow) {
    if(!infoWindow || !infoWindow.overlay) return;
    str = str || '';
    var len = str.length,
      result = str.match(/[^\x00-\xff]/g);
    if (result) len += result.length; // 一行容纳41个单字节字符
    var overRow = Math.max(Math.ceil(len / 41) - 1, 0); // 超出的行数
    overlay.setOffset([offset[infoWindowType][0], offset[infoWindowType][1] + (-13) * overRow]);
  }

  var hasTarget = false;
  // forEachFeatureAtPixel,getFeaturesAtPixel
  var feature = null,
    feature_fence = null,
    feature_mOrG = null,
    features = this.map.getFeaturesAtPixel(event.pixel);
  if (features && !this.drawing) {
    hasTarget = true;
    // 先将新建的图形排在前面，再按面积从小到大排序
    features.sort((a, b) => {
      if(!a.__fence) return true;
      if(!b.__fence) return false;
      return a.__fence.getArea() - b.__fence.getArea();
    });
    // 决定当前点击的feature
    features.forEach((_feature, i) => {
      if (/(marker|geoPoint)/.test(_feature.__type)) {
        feature_mOrG = _feature;
        return true; // 返回true终止forEach循环,以达到优先打开marker和geoPoint的infoWindow
      } else if (i == 0) {
        // 只取第一个fence,以达到只打开第一个（最小面积）图形的infoWindow
        feature_fence = _feature;
      }
    });
    feature = feature_mOrG || feature_fence;
    // 显示目标feature的infoWindow
    var _type = feature.__type,
      infoWindowType;
    if (_type == 'geoPoint') {
      this.showInfoWindow(feature.__geoPoint, 'geoPointInfo');
    }
    if (_type == 'marker') {
      infoWindowType = feature.__marker.data.isSaved ? 'markerInfo' : 'markerEdit';
      setOffset(infoWindowType, feature.__marker.data.remark, this.infoWindows.markerInfo);
      this.showInfoWindow(feature.__marker, infoWindowType);
    }
    // 避免判断成线
    if (_type == 'fence' && !this.drawing && feature.__fence.type != 'LineString') {
      if(feature.__fence.modifyListener) return;
      infoWindowType = feature.__fence.data.isSaved ? 'fenceInfo' : 'fenceEdit';
      setOffset(infoWindowType, feature.__fence.data.remarks, this.infoWindows.fenceInfo);
      this.showInfoWindow(feature.__fence, infoWindowType);
    }
    if (_type == 'lineRemoveFeature') {
      this.map.removeOverlay(feature.tooltipOverlay);
      this.lineLayer.getSource().removeFeature(feature.lineFeature);
      this.lineLayer.getSource().removeFeature(feature);
    }
    if (_type && util.isFunction(this.selectedCallbacks[_type])) {
      this.selectedCallbacks[_type](feature['__' + _type]);
    }
  };
  if (!hasTarget) {
    this.hideAllInfoWindows(this.hideAllInfoWindowsCallback);
  }
}
function getOffset(){
  const offset = {
    geoPointInfo: [-144, -243], // 227+16
    geoPointSendMsg: [-144, -258], // 242+16
    geoPointHandle: [-144, -436], // 420+16
    markerInfo: [-144, -117], // 106+11
    markerEdit: [-144, -206], // 195+11
    fenceInfo: [-144, -204],
    fenceEdit: [-144, -233],
    fenceTermialMg: [-144, -424]
  };
  if (this.mapContainer.parentNode.className.indexOf('lgScreen-true') > -1) {
    offset.geoPointInfo = [-144, -214];
    offset.fenceInfo = [-144, -175];
  }
  return offset;
}

function MapTool(options) {
  if (!util.isObject(options)) options = {};
  // opts仅支持非引用类型的属性（Object.assign仅复制可枚举的属性，属性值是引用类型的，也只拷贝引用值）
  var opts = Object.assign({}, defaultSetting, options);
  this.opts = opts;
  // this.type = this.opts.type; // 定位类型：bd, net
  this.opts.mapType = ''; // 地图源的类型
  this.ol = ol;
  this.mapContainer = null;
  this.map = null;

  // 地图图层layer
  this.mapLayer = null;

  // 定位点layer
  this.geoPointLayer = new ol.layer.Vector({
    source: new ol.source.Vector()
  });

  // 标注点layer
  this.markerLayer = new ol.layer.Vector({
    source: new ol.source.Vector()
  });

  /**
   * Currently drawn feature.
   * @type {ol.Feature}
   */
  this.sketch = new ol.Collection();

  // 当前激活的绘图交互
  this.currentCtrl = '';

  // 绘图交互layer
  this.lineLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: this.sketch
    })
  });

  // 绘图修改交互控件计数器
  this.modifyCount = 0;
  // 是否处于绘图状态
  this.drawing = false;

  this.doubleClickZoom = null; // 鼠标双击缩放地图交互

  // 测距距离、多边形面积显示
  /**
   * Overlay to show the measurement.
   * @type {ol.Overlay}
   */
  this.measureTooltip = null;
  /**
   * The measure tooltip element.
   * @type {Element}
   */
  this.measureTooltipElem = null;
  /**
   * Overlay to show the help messages.
   * @type {ol.Overlay}
   */
  this.helpTooltip = null;
  /**
   * The help tooltip element.
   * @type {Element}
   */
  this.helpTooltipElem = null;

  this.fitToAllGeosCount = 0; // 适配次数累计
  // 定位点集合
  this.geoPoints = {};
  // this.geoPointMenu = new Menu('geoPoint'); // 所有定位点共享一个菜单

  // 栅栏集合
  this.fences = {};
  // this.fenceMenu = new Menu('fence'); // 所有栅栏共享一个菜单
  // 标注集合
  this.markers = {};
  this.count_marker = 0;
  // this.markerMenu = new Menu('marker'); // 所有标注共享一个菜单

  // 存放geoPoint、marker、fence的选中事件回调处理函数
  this.selectedCallbacks = {};
  this.hideAllInfoWindowsCallback = null;

  // 信息窗集合
  this.infoWindows = {}; // 同一类型的信息窗共享一个
}
MapTool.prototype = {
  init(mapContainer, sourceName) {
    if (!mapContainer || mapContainer.nodeType !== 1) {
      throw Error('MapTool.init缺少入参mapContainer');
    }
    this.mapContainer = mapContainer;

    var _mapSource;
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
        this.geoPointLayer,
        this.markerLayer,
        this.lineLayer
      ],
      view: new ol.View({
        center: this.opts.defaultMapCenter,
        // projection: 'EPSG:3857',
        zoom: this.opts.defaultZoom,
        minZoom: this.opts.minZoom,
        maxZoom: this.opts.mapType == 'baidu' ? this.opts.maxZoom_baidu : this.opts.maxZoom,
        // 边界[minx, miny, maxx, maxy]
        extent: (() => {
          if(util.isArray(this.opts.extent) && this.opts.extent.length == 4){
            return ol.proj.transformExtent(this.opts.extent, 'EPSG:4326', 'EPSG:3857');
          }else{
            return this.opts.defaultExtent;
          }
        })()
      }),
      target: this.mapContainer
    });

    this.opts.map = this.map;

    this.getDoubleClickZoom();

    // 监听地图缩放事件
    this.opts.isListenScale && this.listenScale();

    // 自定义控件
    initControl.bind(this)([
      { name: 'measure', type: 'LineString', text: '测距' }
    ]);
    this.opts.mark && this.addControl({
      className: 'mark',
      text: '标注',
      onclick: handleMarkInteraction.bind(this)
    });
    initControl.bind(this)([
      { name: 'circle', type: 'Circle', text: '圆' },
      { name: 'rectangle', type: 'Rectangle', text: '矩形' },
      // { name: 'square', type: 'Square', text: '正方形' },
      { name: 'polygon', type: 'Polygon', text: '多边形' }
    ]);
    this.opts.selectMap && this.addControl('selectMap');
    this.opts.goHome && this.addControl({
      className: 'goHome',
      text: '回到初始位置',
      onclick: this.fitToAllGeos
    });

    // 屏蔽浏览器默认鼠标右击事件
    // document.oncontextmenu = function() {
    //   return false;
    // }
  },
  getDoubleClickZoom() {
    var me = this;
    util.forEach(me.map.getInteractions().getArray(), function(item, i) {
      if (item instanceof ol.interaction.DoubleClickZoom) {
        me.doubleClickZoom = item;
        return;
      }
    });
  },
  mouseoutHandler() {
    this.helpTooltipElem.classList.add('hidden');
  },
  getCoordSystem() {
    return formatCoordSystem(this.opts.mapType);
  },
  transformCoord: transformCoord,
  // 转换地图上所有feature
  transformMap() {
    Object.keys(this.geoPoints).forEach((id, i, array) => {
      var geoPoint = this.geoPoints[id];
      var _coordinate = this.transformCoord([geoPoint.data[this.opts.lngField], geoPoint.data[this.opts.latField]], geoPoint.data.posCoordinateSystem, this.opts.mapType);
      geoPoint.setCoordinate(_coordinate);
    }, this);
    Object.keys(this.markers).forEach((id, i, array) => {
      var marker = this.markers[id];
      var _coordinate = this.transformCoord([marker.data[this.opts.lngField], marker.data[this.opts.latField]], marker.data.posCoordinateSystem, this.opts.mapType);
      marker.setCoordinate(_coordinate);
    }, this);
    Object.keys(this.fences).forEach((id, i, array) => {
      var fence = this.fences[id];
      if (fence.data.fencePointData.indexOf('@') > -1) {
        var _temp = fence.data.fencePointData.split('@');
        var radius = Number(_temp[1]);
        _temp = _temp[0].split(',');
        var center = [Number(_temp[0]), Number(_temp[1])];
        fence.feature.getGeometry().setCenter(transformCoord(center, fence.data.posCoordinateSystem, this.opts.mapType));
      } else {
        var coords = [];
        fence.data.fencePointData.split(';').forEach((item, i, arr) => {
          var _temp = item.split(',');
          coords[i] = transformCoord([Number(_temp[0]), Number(_temp[1])], fence.data.posCoordinateSystem, this.opts.mapType);
        });
        fence.feature.getGeometry().setCoordinates([coords], ol.geom.GeometryLayout.XY);
      }
    }, this);
  },
  // 动态切换地图图层
  // TODO: 百度到谷歌(或高德)互相切换后位置偏移，但是当初始化时指定任一地图均正常
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
  // 根据坐标适配地图
  fitToCoords(coordinates, projectionLink) {
    var lngArr = [],
      latArr = [];
    coordinates.forEach((coordinate, i, array) => {
      if(projectionLink === 'EPSG:3857'){
        lngArr.push(coordinate[0]);
        latArr.push(coordinate[1]);
      }else{
        var __coord = from4326To3857(coordinate);
        lngArr.push(__coord[0]);
        latArr.push(__coord[1]);
      }
    });

    if (!lngArr.length || !latArr.length) {
      this.map.getView().setCenter(this.opts.defaultMapCenter);
      return;
    }

    function compare(a, b) {
      return a - b;
    }
    lngArr.sort(compare);
    latArr.sort(compare);
    var viewer = this.map.getView();
    viewer.fit([lngArr[0], latArr[0], lngArr[lngArr.length - 1], latArr[latArr.length - 1]], this.map.getSize());
    viewer.getZoom() > this.opts.defaultInitMaxZoom && viewer.setZoom(this.opts.defaultInitMaxZoom);
  },
  // 让地图最大化完全地显示所有定位点所在区域
  fitToAllGeos() {
    var lngArr = [],
      latArr = [];
    Object.keys(this.geoPoints).forEach((key, i, array) => {
      lngArr.push(this.geoPoints[key].data.data[0]);
      latArr.push(this.geoPoints[key].data.data[1]);
    });

    if (!lngArr.length || !latArr.length) {
      this.map.getView().setCenter(this.opts.defaultMapCenter);
      return;
    }

    function compare(a, b) {
      return a - b;
    }
    lngArr.sort(compare);
    latArr.sort(compare);
    var viewer = this.map.getView();
    viewer.fit([lngArr[0], latArr[0], lngArr[lngArr.length - 1], latArr[latArr.length - 1]], this.map.getSize());
    viewer.getZoom() > this.opts.defaultInitMaxZoom && viewer.setZoom(this.opts.defaultInitMaxZoom);
    // this.map.getView().fit(arr, {
    //  size: this.map.getSize(),
    //  duration: 2000,
    //  easing: ol.easing.easeOut
    // });
  },
  // 监听地图层级变化，让定位点图标随地图层级变化而变化
  listenScale() {
    function handler(feature) {
      var style = feature.getStyle();
      // 重新设置图标的缩放率，基于层级iconScaleDefaultZoom来做缩放
      style.getImage().setScale(this.map.getView().getZoom() / this.opts.iconScaleDefaultZoom);
      feature.setStyle(style);
    }
    this.map.getView().on('change:resolution', () => {
      Object.keys(this.geoPoints).forEach((key, i, array) => {
        handler.bind(this)(this.geoPoints[key].feature);
      }, this);
      Object.keys(this.markers).forEach((key, i, array) => {
        handler.bind(this)(this.markers[key].feature);
      }, this);
    }, this);
  },
  addControl: addControl,
  /**
   * Handle pointer move.
   * @param {ol.MapBrowserEvent} evt The event.
   */
  pointerMoveHandler(event) {
    if (event.dragging) {
      return;
    }
    /** @type {string} */
    var helpMsg = '鼠标左击开始';

    if (this.sketch instanceof ol.Feature) {
      switch (this.currentCtrl) {
        case 'measure':
          helpMsg = '鼠标左击继续，双击结束';
          break;
        case 'circle':
          helpMsg = '鼠标左击结束';
          break;
        case 'rectangle':
          helpMsg = '鼠标左击结束';
          break;
        case 'polygon':
          helpMsg = '鼠标左击继续，双击结束';
          break;
      }
    }

    this.helpTooltipElem.innerHTML = helpMsg;
    this.helpTooltip.setPosition(event.coordinate);

    this.helpTooltipElem.classList.remove('hidden');
  },
  // 创建绘图交互
  createDrawInteraction(type) {
    var geometryFunction, maxPoints;
    if (type == 'Square') {
      // 根据圆创建正方形
      type = 'Circle';
      geometryFunction = ol.interaction.Draw.createRegularPolygon(4);
    } else if (type == 'Rectangle') {
      // 矩形
      type = 'LineString', maxPoints = 2;
      geometryFunction = function(coordinates, geometry) {
        //如果geometry对象不存在或者为空，则创建  
        if (!geometry) {
          geometry = new ol.geom.Polygon(null);
        }
        //开始点的坐标
        var start = coordinates[0];
        //结束点的坐标
        var end = coordinates[1];
        //根据开始坐标和结束坐标设置绘图点坐标
        geometry.setCoordinates([
          [start, [start[0], end[1]], end, [end[0], start[1]], start]
        ]);
        return geometry;
      }
    }
    var draw = new ol.interaction.Draw({
      type: type,
      // source: this.lineLayer.getSource(), // 注意设置source，这样绘制好的线，就会添加到这个source里
      features: this.sketch,
      style: editingStyle, // 设置绘制时的样式
      geometryFunction: geometryFunction, // 绘制图形的回调函数
      maxPoints: maxPoints || this.opts[type + '_maxPoints'] // 限制不超过n个点
    });

    var fence;

    this.createMeasureTooltip();
    this.createHelpTooltip();


    var listener = null;
    // 监听绘图开始事件
    function handle_drawstart(event) {
      this.drawing = true;
      // event.feature 就是当前绘制完成的线的Feature
      this.sketch = event.feature;
      fence = new Fence(this.lineLayer, this.opts);
      var _opts = {
        posCoordinateSystem: this.getCoordSystem(),
        enabled: false,
        alarmFre: 60,
        remarks: ''
      }
      _opts[this.opts.fenceIdField] = 'add_' + (Object.keys(this.fences).length + 1);
      fence.init(this.sketch, _opts);

      /** @type {ol.Coordinate|undefined} */
      var tooltipCoord = event.coordinate;

      if (this.opts.showFenceArea || fence.type == 'LineString') {
        // 监听图形变化，更新面积提示
        listener = this.sketch.getGeometry().on('change', function(e) {
          var geom = e.target,
            toolTipObj = fence.getToolTipObj();
          this.measureTooltipElem.innerHTML = toolTipObj.text;
          this.measureTooltip.setPosition(toolTipObj.coord);
          fence.areaTipOverlay = this.measureTooltip;
        }, this);
      }
      // 监听双击地图事件触发的drawsend事件
      this.map.on('dblclick', handlerSelected.bind(this), this);
    }
    draw.on('drawstart', handle_drawstart, this);
    // 监听绘图结束事件
    function handle_drawend(event) {

      this.map.un('pointermove', this.pointerMoveHandler, this);
      draw.un('drawstart', handle_drawstart, this);
      this.helpTooltipElem.classList.add('hidden');
      this.map.getViewport().removeEventListener('mouseout', this.mouseoutHandler);

      var _lineRemoveBtn = null;
      if (this.opts.showFenceArea || fence.type == 'LineString') {
        // 测距增加删除按钮
        if (fence.type == 'LineString') {
          _lineRemoveBtn = new ol.Feature({
            geometry: new ol.geom.Point(event.feature.getGeometry().getLastCoordinate())
          });
          _lineRemoveBtn.setStyle(new ol.style.Style({
            text: new ol.style.Text({
              text: 'X',
              fill: new ol.style.Fill({ color: '#f00' }),
              stroke: new ol.style.Stroke({ color: '#f00', width: 2 })
            })
          }));
          this.lineLayer.getSource().addFeature(_lineRemoveBtn);
          _lineRemoveBtn.tooltipOverlay = this.measureTooltip;
        }

        this.measureTooltipElem.className = 'tooltip tooltip-static';
        this.measureTooltip.setOffset([0, -7]);

        // unset tooltip so that a new one can be created
        this.measureTooltipElem = null;
        this.createMeasureTooltip();
        // 解除图形变化监听
        ol.Observable.unByKey(listener);
      }
      this.sketch.setStyle(disabledStyle);

      // reset sketch
      this.sketch = new ol.Collection();

      this.map.removeInteraction(this.doubleClickZoom);
      this.drawing = false;
      fence.updateCenter();

      if (fence.type !== 'LineString') {
        this.addFence(fence);
        this.showInfoWindow(fence, 'fenceEdit');
      }

      // 为解决双击结束绘图时同时触发的DoubleClickZoom
      var me = this;
      setTimeout(() => {
        // 解除双击地图事件
        this.map.un('dblclick', handlerSelected.bind(this), this);
        me.map.removeInteraction(draw);
        me.currentCtrl = ''; // 重置当前的交互控件
        me.map.addInteraction(me.doubleClickZoom);
        // 结束编辑时先解除监听，再延迟重新监听，以避免双击触发的结束操作造成--结束马上错误开始的情况
        draw.on('drawstart', handle_drawstart, this);
        setTimeout(() => {
          // 延迟给_lineRemoveBtn附加类型和feature，以避免单击触发结束后马上触发删除按钮的点击事件
          if (this.opts.showFenceArea || fence.type == 'LineString') {
            _lineRemoveBtn.__type = 'lineRemoveFeature';
            _lineRemoveBtn.lineFeature = fence.feature;
          }
        }, 300);
      }, 200);

    }
    var drawendKey = draw.on('drawend', handle_drawend, this);
    return draw;
  },
  // 加载、更新定位
  loadGeos(arr, type) {
    type = type || 'bd';
    var idField = this.opts[type + '_geoPointIdField'];
    arr.forEach((item, i, array) => {
      item.posCoordinateSystem = item.coordinate;
      item.data = from4326To3857(transformCoord([item[this.opts.lngField], item[this.opts.latField]], item.posCoordinateSystem, this.opts.mapType));
      var geoPoint = this.geoPoints[type + '_' + item[idField]];
      if (!geoPoint) {
        geoPoint = new GeoPoint(this.geoPointLayer, type, this.opts);
        geoPoint.init(item);
        this.geoPoints[geoPoint.id] = geoPoint;
      } else {
        geoPoint.update(item);
      }
    }, this);
    if (!this.opts.isOnlyFirstFitToAllGeos ||
      (this.opts.isOnlyFirstFitToAllGeos && !this.fitToAllGeosCount)) {
      this.fitToAllGeosCount++;
      this.fitToAllGeos();
    }
  },
  // 加载标注点
  loadMarkers(arr) {
    arr.forEach((item, i, array) => {
      item.data = from4326To3857(transformCoord([item[this.opts.lngField], item[this.opts.latField]], item.posCoordinateSystem, this.opts.mapType));
      if (!this.markers[item[this.opts.markerIdField]]) {
        var marker = new Marker(this.markerLayer, this.opts);
        marker.init(item);
        this.markers[marker.id] = marker;
      } else {
        this.markers[item[this.opts.markerIdField]].update(item);
      }
    }, this);
  },
  updateMarkerId(oldId, newId) {
    var marker = this.markers[oldId];
    marker.updateId(newId);
    this.markers[newId] = marker;
    delete this.markers[oldId];
  },
  removeMarker(id) {
    if (this.markers[id]) {
      this.markers[id].destroy();
      delete this.markers[id];
    }
  },
  addFence(arg) {
    var fence = null;
    if (arg instanceof Fence) {
      fence = arg;
    } else if (util.isObject(arg)) {
      // 创建fence、featrue
      var coords = [],
        type = '',
        feature = null;
      if (arg.fencePointData.indexOf('@') > -1) {
        type = 'circle';
        var _temp = arg.fencePointData.split('@');
        var radius = Number(_temp[1]);
        _temp = _temp[0].split(',');
        var center = [Number(_temp[0]), Number(_temp[1])];
        feature = new ol.Feature(new ol.geom.Circle(from4326To3857(transformCoord(center, arg.posCoordinateSystem, this.opts.mapType)), radius, ol.geom.GeometryLayout.XY));
      } else {
        type = 'polygon';
        arg.fencePointData.split(';').forEach((item, i, arr) => {
          var _temp = item.split(',');
          coords[i] = from4326To3857(transformCoord([Number(_temp[0]), Number(_temp[1])], arg.posCoordinateSystem, this.opts.mapType));
        });
        feature = new ol.Feature(new ol.geom.Polygon([coords], ol.geom.GeometryLayout.XY));
      }
      feature.setStyle(arg.enabled ? enabledStyle : disabledStyle);

      this.lineLayer.getSource().addFeature(feature);

      fence = new Fence(this.lineLayer, this.opts);
      fence.type = type;
      fence.init(feature, arg);
    } else {
      throw new Error('mapTool.addFence()入参异常');
    }
    this.fences[fence.id] = fence;
  },
  loadFences(arr) {
    if (util.isArray(arr)) {
      arr.forEach((item, i, array) => {
        this.addFence(item);
      });
    } else {
      throw new Error('MapTool.loadFences()入参异常，必须是Array');
    }
  },
  updateFenceId(oldId, newId) {
    var fence = this.fences[oldId];
    fence.updateId(newId);
    this.fences[newId] = fence;
    delete this.fences[oldId];
  },
  removeFence(id) {
    if (this.fences[id]) {
      if (util.isArray(this.fences[id].modifyListeners)) {
        this.fences[id].modifyListeners.forEach(item => {
          item.target.un(item.event, item.handler, this);
          if (item.removeInteraction) {
            this.map.removeInteraction(item.removeInteraction);
            item.removeInteraction = null;
          }
          if (item.addInteraction) {
            this.map.addInteraction(item.addInteraction);
            item.addInteraction = null;
          }
        });
        this.measureTooltipElem.classList.add('hidden');
        this.modifyCount--;
        this.fences[id].modifyListeners = null;
      }
      this.fences[id].destroy();
      delete this.fences[id];
    }
  },
  removeFences(arr) {
    if (util.isArray(arr)) {
      arr.forEach((item, i, array) => {
        this.removeFence(item);
      });
    } else {
      throw new Error('MapTool.removeFences()入参异常，必须是Array');
    }
  },
  // create a new help tooltip
  createHelpTooltip() {
    if (this.helpTooltipElem) {
      this.helpTooltipElem.parentNode.removeChild(this.helpTooltipElem);
    }
    this.helpTooltipElem = document.createElement('div');
    this.helpTooltipElem.className = 'tooltip hidden';
    this.helpTooltip = new ol.Overlay({
      element: this.helpTooltipElem,
      offset: [15, 0],
      positioning: 'center-left'
    });
    this.map.addOverlay(this.helpTooltip);
  },
  // 绘图控件绘图时的提示
  createHelpTooltip2() {
    var elem = document.createElement('div');
    elem.className = 'tooltip hidden';
    var tipOverlay = new ol.Overlay({
      element: elem,
      offset: [15, 0],
      positioning: 'center-left'
    });
    this.map.addOverlay(tipOverlay);
    return tipOverlay;
  },
  // create a new measure tooltip
  createMeasureTooltip() {
    if (this.measureTooltipElem) {
      this.measureTooltipElem.parentNode.removeChild(this.measureTooltipElem);
    }
    this.measureTooltipElem = document.createElement('div');
    this.measureTooltipElem.className = 'tooltip tooltip-measure';
    this.measureTooltip = new ol.Overlay({
      element: this.measureTooltipElem,
      offset: [0, -15],
      positioning: 'bottom-center'
    });
    this.map.addOverlay(this.measureTooltip);
  },
  // 初始化右键菜单,暂时停用
  initRMenu() {
    return;
    // 屏蔽浏览器默认鼠标右击事件
    document.oncontextmenu = function() {
      return false;
    }
    // 初始化overlay右键菜单
    this.geoPointMenu.init(this.map, [{
      text: '发送短报文',
      onclick: function() {
        alert('发送短报文');
      }
    }]);
    this.fenceMenu.init(this.map, [{
        text: '开启编辑',
        onclick: function() {
          var txt = this.textContent;
          if (txt == '开启编辑') {
            this.textContent = '关闭编辑';
            this.map.addInteraction(this.modify);
            if (this.opts.showFenceArea) {
              // 监听modifyend事件，重新计算面积
              this.menu.target.modifyListener = function() {
                this.areaTipOverlay.getElement().innerHTML = this.getToolTipObj().text;
              }
              this.menu.target.feature.on('change', this.menu.target.modifyListener, this.menu.target);
            }
            this.menu.hide();
          } else {
            this.textContent = '开启编辑';
            this.map.removeInteraction(this.modify);
            if (this.menu.target.modifyListener) {
              this.menu.target.feature.un('change', this.menu.target.modifyListener, this.menu.target);
              this.menu.target.modifyListener = null;
            }
            this.menu.hide();
          }
        }
      },
      {
        text: '启用围栏',
        disabled: true,
        onclick: function() {
          alert('启用围栏');
        }
      },
      {
        text: '增删北斗卡',
        onclick: function() {
          alert('增删北斗卡');
        }
      },
      {
        text: '增删RN设备',
        onclick: function() {
          alert('增删RN设备');
        }
      }
    ]);

    // 为地图注册鼠标事件的监听
    this.mapContainer.onmousedown = (function(event) {
      // 鼠标右击
      if (event.which == 3) {
        var viewport = this.map.getViewport();
        var pixel = [event.clientX - viewport.offsetParent.offsetLeft, event.clientY - viewport.offsetParent.offsetTop];
        this.map.forEachFeatureAtPixel(pixel, (function(feature) {
          if (feature.__type == 'fence') {
            // 为鼠标右击feature发送自定义的showMenu消息
            feature.dispatchEvent({ type: 'showMenu', pixel: pixel });
            // 隐藏菜单overlay
            this.geoPointMenu.hide();
            this.markerMenu.hide();
          } else if (feature.__type == 'geoPoint') {
            feature.dispatchEvent({ type: 'showMenu', pixel: pixel });
            this.fenceMenu.hide();
            this.markerMenu.hide();
          } else if (feature.__type == 'marker') {
            feature.dispatchEvent({ type: 'showMenu', pixel: pixel });
            this.geoPointMenu.hide();
            this.fenceMenu.hide();
          }
        }).bind(this));
      } else {
        this.geoPointMenu.hide();
        this.fenceMenu.hide();
        this.markerMenu.hide();
      }
    }).bind(this);
  },
  hideAllInfoWindows(callback) {
    Object.keys(this.infoWindows).forEach((item, i, array) => {
      this.infoWindows[item].hide();
    }, this);
    util.isFunction(callback) && callback();
  },
  hideInfoWindow(target) {
    this.infoWindows[target] && this.infoWindows[target].hide();
  },
  showInfoWindow(target, infoWindowType) {
    this.hideAllInfoWindows();
    if (target && this.infoWindows[infoWindowType]) {
      this.infoWindows[infoWindowType].target = target;
      var coordinate;
      if (target instanceof GeoPoint || target instanceof Marker) {
        coordinate = target.feature.getGeometry().getCoordinates();
      } else if (target instanceof Fence) {
        coordinate = target.center;
      }
      this.infoWindows[infoWindowType].show(coordinate);
    }
  },
  // 绑定不同的信息窗口到同类型的feature，这里将信息窗overlay并在menu.overlay
  bindInfoWindow(obj) {
    const offset = getOffset.bind(this)();
    Object.keys(obj).forEach((field, i, array) => {
      // 存各类型feature选中回调处理函数
      this.selectedCallbacks[field] = obj[field].selectedCallback;
      obj[field].infoWindows.forEach((item, j, arr) => {
        var infoWindow = new InfoWindow(field),
          infoWindowType = field + item.type;
        infoWindow.init(this.map, item.element, offset[infoWindowType]);
        this.infoWindows[infoWindowType] = infoWindow;
      }, this);
    }, this);
    // 菜单触发事件
    this.map.on('singleclick', handlerSelected.bind(this), this);
  },
  openFenceEdit(success) {
    var target = this.infoWindows.fenceInfo.target;
    target.modifyListeners = [];
    if (target) {
      var helpTipOverlay = this.createHelpTooltip2();
      // 存放原始半径或坐标
      var old_coords, old_radius;
      if(target.type == 'Circle'){
        old_coords = target.getCenter();
        old_radius = target.getRadius();
      }else{
        old_coords = target.getCoordinates();
      }
      var modify = new ol.interaction.Modify({
        features: new ol.Collection([target.feature])
      });
      this.map.addInteraction(modify);
      !this.modifyCount && this.map.removeInteraction(this.doubleClickZoom);
      this.modifyCount++;
      // 监听modifyend事件，重新计算面积
      target.areaTipOverlay = this.measureTooltip;
      helpTipOverlay.getElement().innerHTML = '鼠标双击电子围栏结束';
      helpTipOverlay.getElement().classList.remove('hidden');
      target.modifyListener = function() {
        var toolTipObj = this.getToolTipObj();
        if (this.opts.showFenceArea) {
          this.areaTipOverlay.getElement().innerHTML = toolTipObj.text;
          this.areaTipOverlay.setPosition(toolTipObj.coord);
        }
        helpTipOverlay.setPosition(toolTipObj.coord);
      }
      target.feature.on('change', target.modifyListener, target);
      target.modifyListeners.push({
        event: 'change',
        target: target.feature,
        handler: target.modifyListener,
        removeInteraction: modify
      });

      // 双击围栏结束编辑状态
      var dbclickHandler = function(event) {
        this.map.forEachFeatureAtPixel(event.pixel, (function(feature) {
          if (feature.__fence && feature.__fence.id == target.id) {
            this.map.removeInteraction(modify);
            if (target.modifyListener) {
              target.feature.un('change', target.modifyListener, target);
              target.modifyListener = null;
            }
            modify = null;
            this.modifyCount--;
            this.map.un('dblclick', dbclickHandler, this);
            this.map.removeOverlay(helpTipOverlay);
            setTimeout(() => {
              !this.modifyCount && this.map.addInteraction(this.doubleClickZoom);
              target.modifyListeners = null;
            }, 20);
            util.isFunction(success) && success(target, old_coords, old_radius);
          }
        }).bind(this));
      }
      this.map.on('dblclick', dbclickHandler, this);
      target.modifyListeners.push({
        event: 'dblclick',
        target: this.map,
        handler: dbclickHandler,
        addInteraction: this.doubleClickZoom
      });
    }
    this.infoWindows.fenceInfo.hide();
  }
}

export default MapTool;
