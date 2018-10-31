/* global exports, jshint devel: true */
(function (exports) {
    "use strict";

    exports.web2app = (function () {

        var TIMEOUT_IOS = 2 * 1000,
            TIMEOUT_ANDROID = 3 * 100,
            INTERVAL = 100,
            ua = exports.userAgent(),
            os = ua.os,
            intentNotSupportedBrowserList = [
                'firefox',
                'opr/'
            ];

        function moveToStore (storeURL) {
            top.window.location.href = storeURL;
        }

        function web2app (context) {
            var willInvokeApp = (typeof context.willInvokeApp === 'function') ? context.willInvokeApp : function(){},
                onAppMissing  = (typeof context.onAppMissing === 'function')  ? context.onAppMissing  : moveToStore,
                onUnsupportedEnvironment = (typeof context.onUnsupportedEnvironment === 'function') ? context.onUnsupportedEnvironment : function(){};


            willInvokeApp();

            if (os.android) {
                if (isIntentSupportedBrowser() && context.intentURI && !context.useUrlScheme) {
                    web2appViaIntentURI(context.intentURI);
                } else if (context.storeURL) {
                    web2appViaCustomUrlSchemeForAndroid(context.urlScheme, context.storeURL, onAppMissing);
                }
            } else if (os.ios && context.storeURL) {
                web2appViaCustomUrlSchemeForIOS(context.urlScheme, context.storeURL, onAppMissing, context.universalLink);
            } else {
                setTimeout(function () {
                    onUnsupportedEnvironment();
                }, 100);
            }
        }

        // chrome 25 and later supports intent. https://developer.chrome.com/multidevice/android/intents

      /**
       * 是否支持intent
       * chrome >= 25 && !FF && !O
       * @returns {*|boolean}
       */
      function isIntentSupportedBrowser () {
            var supportsIntent = ua.browser.chrome && +(ua.browser.version.major) >= 25;
            var blackListRegexp = new RegExp(intentNotSupportedBrowserList.join('|'), "i");
            return supportsIntent && !blackListRegexp.test(ua.ua);
        }

      /**
       * android通过自定义urlScheme调起App
       * @param urlScheme url
       * @param storeURL appstore的链接
       * @param fallback 回调函数
       */
        function web2appViaCustomUrlSchemeForAndroid (urlScheme, storeURL, fallback) {
            deferFallback(TIMEOUT_ANDROID, storeURL, fallback);
            launchAppViaHiddenIframe(urlScheme);
        }

      /**
       * todo:
       * @param {number} timeout - 超时时间
       * @param {string} storeURL - 下载链接
       * @param {function} fallback - 回调函数
       * @returns {number}
       */
        function deferFallback(timeout, storeURL, fallback) {
            var clickedAt = new Date().getTime();
            return setTimeout(function () {
                var now = new Date().getTime();
                if (isPageVisible() && now - clickedAt < timeout + INTERVAL) {
                  // 说明没调起成功
                    fallback(storeURL);
                }
            }, timeout);
        }

      /**
       * intent解决Android应用的各项组件之间的通讯
       * todo: intentURI是什么
       * @param {string} launchURI - 跳转url
       */
        function web2appViaIntentURI (launchURI) {
            if ( ua.browser.chrome ){
                move();
            }else{
                setTimeout(move, 100);
            }

            function move(){
                top.window.location.href = launchURI;
            }
        }

      /**
       *
       * @param urlScheme   url
       * @param storeURL  app跳转url
       * @param fallback  回调函数
       * @param universalLink
       */

        function web2appViaCustomUrlSchemeForIOS (urlScheme, storeURL, fallback, universalLink) {
            var tid = deferFallback(TIMEOUT_IOS, storeURL, fallback);
            if (parseInt(ua.os.version.major, 10) < 8) {
                bindPagehideEvent(tid);
            } else {
                bindVisibilityChangeEvent(tid);
            }

            // https://developer.apple.com/library/prerelease/ios/documentation/General/Conceptual/AppSearch/UniversalLinks.html#//apple_ref/doc/uid/TP40016308-CH12
            if ( isSupportUniversalLinks() ){
                if (universalLink === undefined) {
                    universalLink = urlScheme;
                } else {
                    clearTimeout(tid);
                }
                launchAppViaChangingLocation(universalLink);
            }else{
                launchAppViaHiddenIframe(urlScheme);
            }
        }


      /**
       * 绑定页面隐藏事件
       * todo: window@pagehide?
       * @param tid  定时器对象
       */
        function bindPagehideEvent (tid) {
            window.addEventListener('pagehide', function clear () {
                if (isPageVisible()) {
                    clearTimeout(tid);
                    window.removeEventListener('pagehide', clear);
                }
            });
        }

      /**
       * 监听页面可见性变化
       * todo:visibilitychange?
       * @param tid  定时器
       */
        function bindVisibilityChangeEvent (tid) {
            document.addEventListener('visibilitychange', function clear () {
                if (isPageVisible()) {
                    clearTimeout(tid);
                    document.removeEventListener('visibilitychange', clear);
                }
            });
        }

      /**
       * 页面是否可见
       * todo: document.hidden？
       * @returns {boolean}  返回值boolean
       */
        function isPageVisible () {
            var attrNames = ['hidden', 'webkitHidden'];
            for(var i=0, len=attrNames.length; i<len; i++) {
                if (typeof document[attrNames[i]] !== 'undefined') {
                    return !document[attrNames[i]];
                }
            }
            return true;
        }


      /**
       *
       * @param urlScheme  跳转url
       */
        function launchAppViaChangingLocation (urlScheme){
            top.window.location.href = urlScheme;
        }


      /**
       *
       * @param {string} urlScheme - 跳转url
       */
      function launchAppViaHiddenIframe (urlScheme) {
            setTimeout(function () {
                var iframe = createHiddenIframe('appLauncher');
                iframe.src = urlScheme;
            }, 100);
        }

        function createHiddenIframe (id) {
            var iframe = document.createElement('iframe');
            iframe.id = id;
            iframe.style.border = 'none';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.display = 'none';
            iframe.style.overflow = 'hidden';
            document.body.appendChild(iframe);
            return iframe;
        }

      /**
       * 判断是否支持UniversalLinks
       * ios > 8
       * @returns {boolean|*}  返回boolean
       */
        function isSupportUniversalLinks(){
            return (parseInt(ua.os.version.major, 10) > 8 && ua.os.ios);
        }

        /**
         * app.을 실행하거나 / store 페이지에 연결하여 준다.
         * @function
         * @param context {object} urlScheme, intentURI, storeURL, appName, onAppMissing, onUnsupportedEnvironment, willInvokeApp
         * @example daumtools.web2app({ urlScheme : 'daumapps://open', intentURI : '', storeURL: 'itms-app://...', appName: '다음앱' });
         */
        return web2app;

    })();

})((function (){
    if (typeof exports === 'object') {
        exports.daumtools = exports;
        return exports;
    } else if (typeof window === 'object') {
        window.daumtools = (typeof window.daumtools === 'undefined') ? {} : window.daumtools;
        return window.daumtools;
    }
})());