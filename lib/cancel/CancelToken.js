'use strict';

import CanceledError from './CanceledError.js';

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @param {Function} executor The executor function.
 *
 * @returns {CancelToken}
 *  
 */
class CancelToken {
  // 构造函数接收一个executor函数，
  // 提前说明：该函数的回调参数为一个cancel函数
  // 在下面可以看到
  // 执行了该cancel函数之后，就说明这个Token被取消了
  // new CancelToken(()=> cancel=>{})
  constructor(executor) {
    if (typeof executor !== 'function') {
      throw new TypeError('executor must be a function.');
    }

    //这个值执行的时候  会触发Promise的resolve， 改变Promise的状态
    let resolvePromise;

    //Promise 实例
    // 定义一个promise，
    // 将promise的resolve取出来
    // 这样就可以在其他地方更改promise的状态了
    this.promise = new Promise(function promiseExecutor(resolve) {
      resolvePromise = resolve; 
    });

    const token = this;

    // 如果取消了，执行监听函数
    // 也就是通过token.subscripbe收集的订阅函数
    // eslint-disable-next-line func-names
    this.promise.then(cancel => {
      if (!token._listeners) return;

      let i = token._listeners.length;

      while (i-- > 0) {
        token._listeners[i](cancel);
      }
      token._listeners = null;
    });

    // 修改默认的promise.then方法，
    // eslint-disable-next-line func-names
    this.promise.then = onfulfilled => {
      let _resolve;
      // 新建一个promise，然后返回新建的promise
      // 订阅函数
      // eslint-disable-next-line func-names
      const promise = new Promise(resolve => {
        token.subscribe(resolve);
        _resolve = resolve;
      }).then(onfulfilled);

      // 增加cancel函数
      // 取消订阅
      promise.cancel = function reject() {
        token.unsubscribe(_resolve);
      };

      // 返回的是新的promise
      return promise;
    };

    executor(function cancel(message, config, request) {
      // 用token.reason判断是否取消
      if (token.reason) {
        //说明已经取消过了
        // Cancellation has already been requested
        return;
      }

      token.reason = new CanceledError(message, config, request);
      // 执行后会改变promise的状态为fulfilled,
      // 这之后会执行this.promise.then()
      // 注意resolve传入的是CanceledError
      resolvePromise(token.reason);
    });
  }

  /**
   * Throws a `CanceledError` if cancellation has been requested.
   */
  throwIfRequested() {
    if (this.reason) {
      throw this.reason;
    }
  }

  /**
   * Subscribe to the cancel signal
   * 监听取消信号
   */

  subscribe(listener) {
    if (this.reason) {
      listener(this.reason);
      return;
    }

    if (this._listeners) {
      this._listeners.push(listener);
    } else {
      this._listeners = [listener];
    }
  }

  /**
   * Unsubscribe from the cancel signal
   */

  unsubscribe(listener) {
    if (!this._listeners) {
      return;
    }
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   *  // 类的静态方法
      // 返回token和cancel方法
      // 这样就可以通过执行cancel()改变token的状态
   */
  static source() {
    let cancel;
    const token = new CancelToken(function executor(c) {
      cancel = c;
    });
    return {
      token,
      cancel
    };
  }
}

export default CancelToken;
