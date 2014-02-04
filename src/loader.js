/*
 * Copyright 2014 The Polymer Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
(function(scope) {

var urlResolver = scope.urlResolver;

var loader = {
  cacheStyles: function(styles, callback) {
    var css = [];
    for (var i=0, l=styles.length, s; (i<l) && (s=styles[i]); i++) {
      css.push(s.textContent);
    }
    cacheCssText(css.join('\n'), callback);
  },
  xhrStyles: function(styles, callback) {
    var loaded=0, l = styles.length;
    // called in the context of the style
    function loadedStyle(style) {
      //console.log(style.textContent);
      loaded++;
      if (loaded === l && callback) {
        callback();
      }
    }
    for (var i=0, s; (i<l) && (s=styles[i]); i++) {
      xhrLoadStyle(s, loadedStyle);
    }
  }
};

// use the platform to preload styles
var preloadElement = document.createElement('preloader');
preloadElement.style.display = 'none';
var preloadRoot = preloadElement.createShadowRoot();
document.head.appendChild(preloadElement);

function cacheCssText(cssText, callback) {
  var style = createStyleElement(cssText);
  if (callback) {
    style.addEventListener('load', callback);
    style.addEventListener('error', callback);
  }
  preloadRoot.appendChild(style);
}

function createStyleElement(cssText, scope) {
  scope = scope || document;
  scope = scope.createElement ? scope : scope.ownerDocument;
  var style = scope.createElement('style');
  style.textContent = cssText;
  return style;
}

function xhrLoadStyle(style, callback) {
  var tc = style.textContent;
  var root = style.ownerDocument.baseURI;
  var done = function(_, content) {
    style.textContent = content;
    callback(style);
  };
  recursiveFlatten(tc, {url: root}, 0, done);
}

function xhr(url) {
  var request = new XMLHttpRequest();
  if (scope.flags.debug || scope.flags.bust) {
    url += '?' + Math.random();
  }
  request.open('GET', url, true);
  request.send();
  return request;
}

function recursiveFlatten(tc, mc, idx, callback) {
  tc = urlResolver.resolveCssText(tc, mc.url);
  var imports = atImportUrls(tc, mc.url);
  var inflight = imports.length;

  // bail early
  if (!inflight) {
    return callback(idx, tc);
  }

  // replace indexed @import rule with text
  var done = function(index, content) {
    // inline the content from the @import
    tc = tc.replace(imports[index].matched, content);
    inflight--;
    // if no more imports, return with flattened text
    if (inflight === 0) {
      callback(idx, tc);
    }
  };

  for (var i = 0; i < inflight; i++) {
    var m = imports[i];
    m.index = i;

    // xhr the @import
    var req = xhr(m.url);

    // flatten the import before returning
    req.onload = function() {
      var content = this.response || this.responseText;
      recursiveFlatten(content, this.match, this.match.index, done);
    }.bind(req);

    // clean up the failed request cleanly
    req.onerror = function() {
      done(this.match.index, '');
    }.bind(req);

    // attach the match object to the request
    req.match = m;
  }
}

var atImportRe = /@import\s+(?:url)?["'\(]*([^'"\)]*)['"\)]*;/g;

// get the @import rules from a style
function atImportUrls(tc, root) {
  var matches = [];
  var rm;
  while ((rm = atImportRe.exec(tc))) {
    var u = new URL(rm[1], root);
    var obj = {matched: rm[0], url: u.href};
    matches.push(obj);
  }
  return matches;
}

// exports
scope.loader = loader;

})(window.Platform);
