# ol-util

> 基于openlayers4的二维地图工具类

本工具采用ES6语法，运用了less技术，使用时需要相应的包支持，在demo中给出了示例

#####引入：

```
import { MapTool, MapTrack } from 'ol-util/index.js'
```

MapTool: 地图标注、电子围栏、地图切换

MapTrack: 历史轨迹、实时轨迹

#####自定义图标

在libs/ol/base.js中根据实际项目UI设置图标

#####地图切换

在libs/ol/base.js中放开mapStore中已有的地图资源或自行新增地图资源

**注：本工具直接从项目中剥离，暂未进行独立封装，使用时若不符合需求（图标、地图）请自行自定义修改**