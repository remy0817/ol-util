/**
 * @filename 
 * @authors remy
 * @creatTime 2017-09-19 15:54:32
 * @description 数据类型判断
 * @version 0.0.1
 */

export default {
  /**
   * 判读是否是Object
   * @param param, isPure(是否需要判断是否是纯净的object,如dom不是纯净的object,默认ture)
   * @return boolean
   */
  isObject: function(param, isPure) {
    if (undefined === param) return false; //undefined正常情况下返回'[object Undefined]',但在ie8中返回'[object Object]'
    !this.isBoolean(isPure) && (isPure = true);
    if (isPure) {
      return Object.prototype.toString.call(param) == '[object Object]';
    } else {
      return this.isArray(param) ? false : typeof param === 'object';
    }
  },
  /**
   * 判读是否是Array
   * @param param
   * @return boolean
   */
  isArray: function(param) {
    return Object.prototype.toString.call(param) == '[object Array]';
  },
  /**
   * 判读是否是String
   * @param param
   * @return boolean
   */
  isString: function(param) {
    return Object.prototype.toString.call(param) == '[object String]';
  },
  isFunction: function(param) {
    return Object.prototype.toString.call(param) == '[object Function]';
  },
  isNumber: function(param) {
    return Object.prototype.toString.call(param) == '[object Number]';
  },
  isBoolean: function(param) {
    return Object.prototype.toString.call(param) == '[object Boolean]';
  },
  isDate: function(param) {
    return Object.prototype.toString.call(param) == '[object Date]';
  },
  /**
   * 判读是否是undifined/null/''/[]/{}
   * @param param
   * @return boolean
   */
  isEmpty: function(param) {
    if (!param) {
      return true;
    } else if (this.isArray(param) && !param.length) {
      return true;
    } else if (this.isObject(param)) {
      for (key in param) {
        return false;
      }
      return true;
    }
    return false;
  }
}
