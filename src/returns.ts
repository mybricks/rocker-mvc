import {PassThrough, Stream} from "stream";
import * as _Types from "./types";
import {RenderWrap} from "./types";

export class FlushStreamResp extends PassThrough {
  koaCtx

  flushAry

  _flush(content?){
    if(!this.flushAry){
      this.flushAry = []
    }
    this.flushAry.unshift(content)
  }

  _run(){
    if(this.flushAry&&this.flushAry.length>0){
      setTimeout(v=>{
        const ct = this.flushAry.pop()
        if(ct){//undefined end
          this.koaCtx.res.write(JSON.stringify(ct));
          this._run()
        }else{
          this.end(null);
        }
      })
    }else{
      setTimeout(v=>{
        this._run()
      },100)
    }
  }

  _initKOACtx(koaCtx) {
    this.koaCtx = koaCtx;

    this.koaCtx.res.write(JSON.stringify({state: 'start'}));

    this._run()
  }

  push(content) {
    this._flush({state: 'flush', content})
  }

  end(content) {
    if (content) {
      this._flush({state: 'flush', content})
      this._flush()
    } else {
      this._flush()
    }
  }
}

export class RedirectResp extends _Types.ResponseWrap {

  private _url: string;
  /**
   * Response header's code,301\302(default)
   */
  private _code: 302 | 301 = 302;

  constructor(url: string) {
    super();
    this._url = url;
  }

  get url() {
    return this._url;
  }

  get code() {
    return this._code;
  }

  set code(code: 302 | 301) {
    this._code = code;
  }
}

export class DownloadResp extends _Types.ResponseWrap {
  private _stream: Stream;
  private _name: string;

  constructor(name: string, stream: Stream) {
    super();
    this._name = name;
    this._stream = stream;
  }

  get name() {
    return this._name;
  }

  get stream() {
    return this._stream;
  }
}

/**
 * Render for return
 */
export class RenderResp extends RenderWrap {
  private _name: string;
  private _model: object;

  /**
   * Constructor
   * @param name The key in render description of
   * @param model
   */
  constructor(name: string, model: object) {
    super();
    this._name = name;
    this._model = model;
  }

  get name(): string {
    return this._name;
  }

  get model(): object {
    return this._model;
  }
}

export class ResourceResp extends RenderWrap {
  private _name: string;

  /**
   * Constructor
   * @param name The key in render description of
   */
  constructor(name: string) {
    super();
    this._name = name;
  }

  get name(): string {
    return this._name;
  }
}