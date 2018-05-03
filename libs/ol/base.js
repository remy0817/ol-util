/**
 * @filename base.js
 * @authors remy
 * @creatTime 2017-10-10 15:59:57
 * @description 引入openLayers的入口，完成一些公共的配置，提供一些公共的方法
 * @updateTime 2017-10-12 14:35:59 v0.1.0 增加地图切换
 * @version 0.1.2
 */

import ol from 'openlayers/dist/ol.js';

ol.geom.GeometryLayout = {
  XY: 'XY',
  XYZ: 'XYZ',
  XYM: 'XYM',
  XYZM: 'XYZM'
};

import 'openlayers/css/ol.css';

import elemUtil from '../elementExtend.js';

import util from '../util/typeJudge/index.js';
import coordTransform from './coordTransform.js';

import markerImg from '../../assets/map_sign.png';
// 通用
import bd_dangerImg from '../../assets/map_icon_net_normal.png';
import bd_alarmImg from '../../assets/map_icon_net_normal.png';
import bd_normalImg from '../../assets/map_icon_net_normal.png';
import bd_safeImg from '../../assets/map_icon_net_normal.png';
import net_alarmImg from '../../assets/map_icon_net_normal.png';
import net_normalImg from '../../assets/map_icon_net_normal.png';
// 人
import bd_man_dangerImg from '../../assets/map_icon_net_normal.png';
import bd_man_alarmImg from '../../assets/map_icon_net_normal.png';
import bd_man_normalImg from '../../assets/map_icon_net_normal.png';
import bd_man_safeImg from '../../assets/map_icon_net_normal.png';
import net_man_alarmImg from '../../assets/map_icon_net_normal.png';
import net_man_normalImg from '../../assets/map_icon_net_normal.png';
// 车
import bd_car_dangerImg from '../../assets/map_icon_net_normal.png';
import bd_car_alarmImg from '../../assets/map_icon_net_normal.png';
import bd_car_normalImg from '../../assets/map_icon_net_normal.png';
import bd_car_safeImg from '../../assets/map_icon_net_normal.png';
import net_car_alarmImg from '../../assets/map_icon_net_normal.png';
import net_car_normalImg from '../../assets/map_icon_net_normal.png';
// 船
import bd_ship_dangerImg from '../../assets/map_icon_net_normal.png';
import bd_ship_alarmImg from '../../assets/map_icon_net_normal.png';
import bd_ship_normalImg from '../../assets/map_icon_net_normal.png';
import bd_ship_safeImg from '../../assets/map_icon_net_normal.png';
import net_ship_alarmImg from '../../assets/map_icon_net_normal.png';
import net_ship_normalImg from '../../assets/map_icon_net_normal.png';
// 飞机
import bd_aircraft_dangerImg from '../../assets/map_icon_net_normal.png';
import bd_aircraft_alarmImg from '../../assets/map_icon_net_normal.png';
import bd_aircraft_normalImg from '../../assets/map_icon_net_normal.png';
import bd_aircraft_safeImg from '../../assets/map_icon_net_normal.png';
import net_aircraft_alarmImg from '../../assets/map_icon_net_normal.png';
import net_aircraft_normalImg from '../../assets/map_icon_net_normal.png';

const icons = {
  markerImg: markerImg,
  bd_normalGeoImg: bd_normalImg,
  bd_warnGeoImg: bd_alarmImg,
  bd_alarmGeoImg: bd_dangerImg,
  bd_safeGeoImg: bd_safeImg,
  net_warnGeoImg: net_alarmImg,
  net_normalGeoImg: net_normalImg,
  bd_man_normalGeoImg: bd_man_normalImg,
  bd_man_warnGeoImg: bd_man_alarmImg,
  bd_man_alarmGeoImg: bd_man_dangerImg,
  bd_man_safeGeoImg: bd_man_safeImg,
  net_man_warnGeoImg: net_man_alarmImg,
  net_man_normalGeoImg: net_man_normalImg,
  bd_car_normalGeoImg: bd_car_normalImg,
  bd_car_warnGeoImg: bd_car_alarmImg,
  bd_car_alarmGeoImg: bd_car_dangerImg,
  bd_car_safeGeoImg: bd_car_safeImg,
  net_car_warnGeoImg: net_car_alarmImg,
  net_car_normalGeoImg: net_car_normalImg,
  bd_ship_normalGeoImg: bd_ship_normalImg,
  bd_ship_warnGeoImg: bd_ship_alarmImg,
  bd_ship_alarmGeoImg: bd_ship_dangerImg,
  bd_ship_safeGeoImg: bd_ship_safeImg,
  net_ship_warnGeoImg: net_ship_alarmImg,
  net_ship_normalGeoImg: net_ship_normalImg,
  bd_aircraft_normalGeoImg: bd_aircraft_normalImg,
  bd_aircraft_warnGeoImg: bd_aircraft_alarmImg,
  bd_aircraft_alarmGeoImg: bd_aircraft_dangerImg,
  bd_aircraft_safeGeoImg: bd_aircraft_safeImg,
  net_aircraft_warnGeoImg: net_aircraft_alarmImg,
  net_aircraft_normalGeoImg: net_aircraft_normalImg
}

function formatCoordSystem(cs) {
  if (cs === '0') cs = 0;
  if (util.isNumber(cs) && (cs === 0 || cs == 1 || cs == 2 || cs == 3)) {
    if (cs === 0) cs = 3;
    return cs;
  } else {
    switch (true) {
      case cs == 'google' || cs == 'googleOffline' || cs == 'googleSatellite' || cs == 'gaode':
        return 1;
      case cs == 'baidu':
        return 2;
      default:
        throw new Error('mapTool中formatCoordSystem()暂不支持' + cs + '坐标系转换');
    }
  }
}

/*
 * @param coordinate { Coordinate }
 * @param from { CoordSystem }
 * @param to { CoordSystem }
 * CoordSystem: 1 -- gcj02(谷歌，高德); 2 -- bd09(百度); 3 -- wgs84(原始的，标准的)
 * @return { Coordinate }
 */
function transformCoord(coordinate, from, to) {
  from = formatCoordSystem(from);
  to = formatCoordSystem(to);
  if (from == to) return coordinate;
  if (util.isArray(coordinate) && coordinate.length == 2) {
    switch (true) {
      case from == 1 && to == 2:
        return coordTransform.gcj02tobd09(coordinate[0], coordinate[1]);
      case from == 2 && to == 1:
        return coordTransform.bd09togcj02(coordinate[0], coordinate[1]);
      case from == 3 && to == 1:
        return coordTransform.wgs84togcj02(coordinate[0], coordinate[1]);
      case from == 1 && to == 3:
        return coordTransform.gcj02towgs84(coordinate[0], coordinate[1]);
      case from == 2 && to == 3:
        var _temp = transformCoord(coordinate, 2, 1);
        return transformCoord(_temp, 1, 3);
      case from == 3 && to == 2:
        var _temp = transformCoord(coordinate, 3, 1);
        return transformCoord(_temp, 1, 2);
    }
  } else {
    throw new Error('mapTool.transformCoord(coordinate, from, to)入参异常，coordinate为[lng, lat], from/to为1/2/3');
  }
}

/**
 * @param Array/Object/String, Function
 * @description 遍历工具
 */
util.forEach = function(param, callback) {
  if (typeof callback !== 'function') throw new Error('Object.forEach缺少入参回调函数');
  if (util.isObject(param)) {
    var key;
    for (key in param) {
      callback(key, param[key]);
    };
  } else if (util.isArray(param) || util.isString(param)) {
    var i = 0;
    for (i; i < param.length; i++) {
      callback(param[i], i);
    };
  } else {
    throw new Error('Object.forEach第一个参数必须是Array/Object/String类型');
  }
}

const wgs84Sphere = new ol.Sphere(6378137);

// google地图的矢量路网数据源
var googleSource = new ol.source.XYZ({
  url: 'https://www.google.cn/maps/vt/pb=!1m4!1m3!1i{z}!2i{x}!3i{y}!2m3!1e0!2sm!3i345013117!3m8!2szh-CN!3scn!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0'
});

// google地图的影像数据源
var googleSatelliteSource = new ol.source.XYZ({
  url: 'https://www.google.cn/maps/vt?lyrs=s@740&gl=cn&x={x}&y={y}&z={z}'
});

// google地图自定义离线地图数据源
var googleOfflineSource = new ol.source.XYZ({
  url: 'ol4/images/google/{z}/z={z}&x={x}&y={y}.png'
});

// 创建百度地图的数据源
function createBaiduSource(isSatellite) {
  // 自定义分辨率和瓦片坐标系
  var resolutions = [],
    maxZoom = 18;
  // 计算百度使用的分辨率
  for (var i = 0; i <= maxZoom; i++) {
    resolutions[i] = Math.pow(2, maxZoom - i);
  }
  var tilegrid = new ol.tilegrid.TileGrid({
    origin: [0, 0], // 设置原点坐标
    resolutions: resolutions // 设置分辨率
  });

  return new ol.source.TileImage({
    projection: 'EPSG:3857',
    tileGrid: tilegrid,
    tileUrlFunction: function(tileCoord, pixelRatio, proj) {
      var z = tileCoord[0],
        x = tileCoord[1],
        y = tileCoord[2];
      // 百度瓦片服务url将负数使用M前缀来标识
      if (x < 0) {
        x = 'M' + (-x);
      }
      if (y < 0) {
        y = 'M' + (-y);
      }
      var hash = (x << z) + y,
        len = 5; // [0, 1, 2, 3, 4]
      var index = hash % 5;
      index = index < 0 ? index + 5 : index;
      if (isSatellite) {
        // 卫星地图
        return 'http://shangetu' + index + '.map.bdimg.com/it/u=x=' + x + ';y=' + y + ';z=' + z + ';v=009;type=sate&fm=46&app=webearth2&v=009&udt=20171031'
      } else {
        // url最后的参数p=1时显示路网，p=0时不显示路网
        return 'http://online' + index + '.map.bdimg.com/onlinelabel/?qt=tile&x=' + x + '&y=' + y + '&z=' + z + '&styles=pl&udt=20160426&scaler=1&p=1';
      }
    }
  });
}
// 百度地图的矢量路网数据源
var baiduSource = createBaiduSource();
// 百度地图的影像数据源
var baiduSatelliteSource = createBaiduSource(true);

// open Street Map的数据源
var osmSource = new ol.source.XYZ({
  url: 'http://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
});

/** 高德地图瓦片地址解析
 * lang可以通过zh_cn设置中文，en设置英文，size基本无作用
 * scl设置标注还是底图，scl=1代表注记，scl=2代表底图（矢量或者影像）
 * style设置影像和路网，style=6为影像图，style=7为矢量路网，style=8为影像路网
 */
// 高德地图的矢量路网数据源
var gaodeSource = new ol.source.XYZ({
  url: 'https://webst0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'
});

// 高德地图的影像数据源
var gaodeSatelliteSource = new ol.source.XYZ({
  url: 'https://webst0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}'
});

// Bing中文地图的数据源
var bingSource = new ol.source.XYZ({
  tileUrlFunction: function(tileCoord) {
    var z = tileCoord[0];
    var x = tileCoord[1];
    var y = -tileCoord[2] - 1;
    var result = '',
      zIndex = 0;

    for (; zIndex < z; zIndex++) {
      result = ((x & 1) + 2 * (y & 1)).toString() + result;
      x >>= 1;
      y >>= 1;
    }
    return 'http://dynamic.t0.tiles.ditu.live.com/comp/ch/' + result + '?it=G,VE,BX,L,LA&mkt=zh-cn,syr&n=z&og=111&ur=CN';
  }
});

// yahoo地图的数据源
var yahooSource = new ol.source.XYZ({
  tileSize: 512,
  url: 'https://{0-3}.base.maps.api.here.com/maptile/2.1/maptile/newest/normal.day/{z}/{x}/{y}/512/png8?lg=ENG&ppi=250&token=TrLJuXVK62IQk0vuXFzaig%3D%3D&requestid=yahoo.prod&app_id=eAdkWGYRoc4RfxVo0Z4B'
});

// 地图数据源集
var mapSources = {
  baidu: baiduSource,
  baiduSatellite: baiduSatelliteSource,
  google: googleSource,
  googleSatellite: googleSatelliteSource,
  googleOffline: googleOfflineSource,
  gaode: gaodeSource,
  gaodeSatellite: gaodeSatelliteSource,
  osm: osmSource,
  bing: bingSource,
  yahoo: yahooSource
};

// 获取logo图标的dom
function getLogoElement(opts) {
  var logoElement = document.createElement('a');
  logoElement.href = opts.logoHref;
  logoElement.target = '_blank';

  var logoImage = document.createElement('img');
  logoImage.src = opts.logoImgSrc;

  logoElement.appendChild(logoImage);
  return logoElement;
}

// 获取ol4内置控件
function getControls(opts) {
  var controls = [];
  // 指北针控件
  if (opts.rotate) controls.push(new ol.control.Rotate({ tipLabel: '恢复正北方向' }));
  // 全屏控件
  if (opts.fullScreen) controls.push(new ol.control.FullScreen({ label: '', labelActive: '', tipLabel: '全屏开关' }));
  // 鼠标位置控件
  if (opts.mousePosition) {
    // 自定义参数
    var mousePositionControl = new ol.control.MousePosition({
      coordinateFormat: ol.coordinate.createStringXY(11),
      projection: 'EPSG:4326',
      // comment the following two lines to have the mouse position
      // be placed within the map.
      // className: 'custom-mouse-position',
      // target: document.getElementById('mouse-position'),
      // undefinedHTML: '&nbsp;'
    });
    // 默认：new ol.control.MousePosition()
    controls.push(mousePositionControl);
  }
  // 缩略图控件
  if (opts.overviewMap) controls.push(new ol.control.OverviewMap({ tipLabel: '缩略图' }));
  // 比例尺控件
  if (opts.scaleLine) controls.push(new ol.control.ScaleLine());
  // 缩放按钮控件
  if (opts.zoom) controls.push(new ol.control.Zoom({ zoomInTipLabel: '放大一级', zoomOutTipLabel: '缩小一级' }));
  // 缩放滚动条控件
  if (opts.zoomSlider) controls.push(new ol.control.ZoomSlider());
  // 缩放到范围控件
  if (opts.zoomToExtent) controls.push(new ol.control.ZoomToExtent({ tipLabel: '缩放到边界' }));
  return controls;
}

// 目前支持的地图切换
const mapStore = {
  // baidu: '百度地图',
  gaode: '高德地图',
  // google: '谷歌地图',
  // baiduSatellite: '百度卫星',
  // gaodeSatellite: '高德卫星',
  // googleSatellite: '谷歌卫星'
}

// 自定义控件
function addControl(attrs) {
  if(!attrs) return;
  var viewport = this.map.getViewport();
  if(attrs.className === 'goHome'){
    var toolContainer = this.mapContainer.eFind('.toolbar-right-bottom')[0];
    if (!toolContainer) {
      toolContainer = document.createElement('div');
      toolContainer.className = 'toolbar-right-bottom';
      this.mapContainer.appendChild(toolContainer);
    }
    var elem = document.createElement(attrs.tag || 'div');
    elem.className = attrs.className + ' iconfont icon-locate';
    elem.title = attrs.text;
    elem.addEventListener('click', attrs.onclick.bind(this), false);
    toolContainer.appendChild(elem);
    return;
  }

  var toolContainer = this.mapContainer.eFind('.toolbar-right-top')[0];
  if (!toolContainer) {
    toolContainer = document.createElement('div');
    toolContainer.className = 'toolbar-right-top';
    this.mapContainer.appendChild(toolContainer);
  }
  if (attrs === 'selectMap') {
    // 地图切换控件
    var elem = document.createElement('div');
    elem.className = 'selector mapSource';
    var showElem = document.createElement('div');
    showElem.textContent = mapStore[this.opts.mapType];
    elem.appendChild(showElem);
    var mapOptions = document.createElement('div');
    mapOptions.className = 'options';
    Object.keys(mapStore).forEach((name, i, array) => {
      var option = document.createElement('div');
      option.className = name;
      option.textContent = mapStore[name];
      option.onclick = (function() {
        var oldMapType = this.opts.mapType;
        this.setMapSource(name);
        var newMapType = this.opts.mapType;
        if ((oldMapType == 'baidu' || newMapType == 'baidu') && oldMapType != newMapType) {
          this.map.getView().setCenter(transformCoord(this.map.getView().getCenter(), oldMapType, newMapType));
          this.transformMap(oldMapType);
        }
        showElem.textContent = mapStore[name];
        elem.className = 'selector mapSource';
      }).bind(this);
      mapOptions.appendChild(option);
      elem.appendChild(mapOptions);
    }, this);
    elem.onmouseover = function() {
      this.className = 'selector mapSource opened';
    }
    elem.onmouseleave = function() {
      this.className = 'selector mapSource closed';
    }
    var icon = document.createElement('i');
    icon.className = 'iconfont icon-pageNext-liner';
    elem.appendChild(icon);
    toolContainer.appendChild(elem);
  } else {
    if (!util.isFunction(attrs.onclick)) throw Error('this.addControl入参attrs.onclick必须是Function类型');
    if (attrs.className == 'circle' || attrs.className == 'polygon' ||
      attrs.className == 'rectangle' || attrs.className == 'Square') {
      var elem = toolContainer.eChildren('.selector')[0];
      if (!elem) {
        elem = document.createElement('div');
        elem.className = 'selector fenceType';
        var showDiv = document.createElement('div');
        showDiv.textContent = '电子围栏';
        var fenceOptions = document.createElement('div');
        fenceOptions.className = 'options';
        elem.appendChild(showDiv);
        elem.appendChild(fenceOptions);
        elem.onmouseover = function() {
          this.className = 'selector fenceType opened';
        }
        elem.onmouseleave = function() {
          this.className = 'selector fenceType closed';
        }
        var icon = document.createElement('i');
        icon.className = 'iconfont icon-pageNext-liner';
        elem.appendChild(icon);
        toolContainer.appendChild(elem);
      }
      var fenceOptions = elem.eChildren('.options')[0];
      var option = document.createElement('div');
      option.className = attrs.className;
      option.innerHTML = attrs.text;
      option.onclick = attrs.onclick.bind(this);
      fenceOptions.appendChild(option);
    } else {
      var elem = document.createElement(attrs.tag || 'div');
      elem.className = attrs.className;
      elem.innerHTML = attrs.text;
      elem.addEventListener('click', attrs.onclick.bind(this), false);
      toolContainer.appendChild(elem);
    }
  }
}

export default {
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
}

export {
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
}
