/*!
 * Rocker-MVC
 *
 * MVC Framework for typescript
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */
import {Start} from './src/config';
import * as PATH from "path";

Start.importPath = PATH.dirname(module.parent['filename']);

export * from './src/main';