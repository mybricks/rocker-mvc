export function isEmpty(v: any) {
  return typeof v === 'undefined' || v == null || typeof v === 'string' && v.trim() === '';
}

export function isFunction(fn) {
  return !isEmpty(fn) && Object.prototype.toString.call(fn) === '[object Function]';
}


export function isGenerator(obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

export function isGeneratorFunction(obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

export function getExtends(fn) {
  const pfn = Object.getPrototypeOf(fn);
  return pfn;
}

export function sleep(ms, r?: (Function)) {
  return new Promise(r => {
    setTimeout(r, ms);
  })
}

export function getLocalIp() {
  var os = require("os");
  var localIp = "127.0.0.1";
  var interfaces = os.networkInterfaces();
  for (var devName in interfaces) {
    var devInterface = interfaces[devName];
    for (var i = 0; i < devInterface.length; i++) {
      var iface = devInterface[i];
      if (iface.family == "IPv4" && !iface.internal && iface.address !== localIp && iface.address.indexOf(":") < 0) {
        localIp = iface.address;
        return localIp;
      }
    }
  }
  return localIp;
}

/**
 * Get bootstrap module
 *
 * Notice:maybe an error here
 *
 * @param {NodeJS.Module} md
 * @returns {NodeJS.Module}
 */
export function getBootstrapModule(md) {
  let cur = md;
  while (cur.parent && cur.parent !== cur) {
    cur = cur.parent;
  }
  return cur;
}

export function genTraceId() {
  current = (current >= MAX) ? 1 : current + 1;
  let nowTime = new Date().getTime();
  let lowInt = nowTime % TWO_PWR_32_DBL, highInt = nowTime / TWO_PWR_32_DBL;
  buffer.writeInt16BE(current, 0); // 2:seq
  buffer.writeInt32BE(highInt, 2);//4: 当前时间的高4位
  buffer.writeUInt32BE(lowInt, 6);//4: 当前时间的低4位
  buffer.fill(LOCAL_IP_BUFFER, 10, 14);//4: IP
  buffer.writeInt16BE(PID, 14);//2: PID
  return buffer.toString("hex").toLowerCase();
}

//--------------------------------------------------------------------------

const MAX_INT_16 = 32767;
const TWO_PWR_8_DBL = 1 << 8;
const LOCAL_IP = getLocalIp();
const PID = getPid();
const VERSION = "0.0.1";

function replaceStr(str) {
  if (str == null) {
    return '-';
  }
  return str.replace(/\||\n|\/pub_check|\/status\.ok/ig, ' ');
}

function getPid() {
  var pid = require("process").pid;
  if (pid > MAX_INT_16) {
    pid = pid % TWO_PWR_8_DBL;
  }
  return pid;
}

function getAppName() {
  return process.env.APP;
}

const UTILS = {
  localIp: LOCAL_IP,
  pid: PID,
  traceReplace: replaceStr,
  appName: getAppName,
  VERSION: VERSION
};

const TWO_PWR_16_DBL = 1 << 16;
const TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
const LOCAL_IP_BUFFER = ipToBytes(UTILS.localIp);
const MAX = 8000;
const buffer = Buffer.alloc ? Buffer.alloc(16) : new Buffer(16);
var current = 0;

function ipToBytes(ip) {
  var array = ip.split("\.");
  var buffer = new Buffer(4);
  buffer.writeUInt8(array[0], 0);
  buffer.writeUInt8(array[1], 1);
  buffer.writeUInt8(array[2], 2);
  buffer.writeUInt8(array[3], 3);
  return buffer;
}