'use strict';


//const request = require("request");

const STATES = {};
let GLOBAL = {};
var activeTabId;
var tab_id = null;

/* globals chrome */
const FILTER_SEARCH = { urls: ["*://*/rest/search/*", "*://*/search/*", "*://*/*/search/*", "*://*/*/CoveoSearch/*", "*://*/?errorsAsSuccess=1", "*://*/*&errorsAsSuccess=1*", "https://*/rest/search/v2*", "https://*/coveo-search/v2*", "https://*/*/rest/search/v2*", "https://*/*/*/rest/search/v2*", "https://*/coveo/rest/v2*", "https://cloudplatform.coveo.com/rest/search/*", "*://platform.cloud.coveo.com/rest/search/v2/*", "https://search.cloud.coveo.com/rest/search/v2/*", "*://*/*/coveo/platform/rest/*", "*://*/coveo/rest/*"] };

let getTabId_Then = (callback) => {
  this.getActiveTab((tabs) => {
    callback(tabs);
  });
};

function getTime() {
  var local = new Date();
  var localdatetime = local.getHours() + ":" + pad(local.getMinutes()) + ":" + pad(local.getSeconds());
  return localdatetime;
}

function pad(t) {
  var st = "" + t;

  while (st.length < 2)
    st = "0" + st;

  return st;
}



let resetState = (tabId) => {
  if (tabId) {
    STATES[tabId] = {
      tabId,
      loadedScript: false,
      warningSent: false,
      enabled: false,
      document_url: ''
    };
    let state = STATES[tabId];
    //Add global state
    state = Object.assign(state, GLOBAL);
    STATES[tabId] = state;
  }
  else {
    getTabId_Then(resetState);
  }
};

let getState = (tabId) => {
  //tabId = "Default";
  let state = STATES[tabId];
  if (!state) {
    resetState(tabId);
  }
  return STATES[tabId];
};

let getState_Then = (callback) => {
  getTabId_Then(tabId => {
    callback(getState(tabId));
  });
};

let saveGlobal = (obj) => {
  let state = Object.assign(GLOBAL, obj);
  GLOBAL = state;
};

let saveState = (obj, tabId) => {
  //tabId = "Default";
  console.log("Saving STATE: " + tabId);
  if (tabId) {
    let state = Object.assign(getState(tabId), obj);
    STATES[tabId] = state;
  }
  else {
    getTabId_Then(tabId => {
      console.log("Saving STATE without tabid: " + tabId);
      saveState(obj, tabId);
    });
  }
};



let SendMessage = (parameters) => {
  setTimeout(() => {
    try {
      chrome.runtime.sendMessage(parameters);
    }
    catch (e) {
      console.log("EXCEPT: " + e);
    }
  });
};


chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  //console.log(msg.action);
  if (msg.type === 'getState') {
    getTabId_Then(tabId => {
      getState_Then(state => {

        processUpdate(state);

        sendResponse(state);
      });
    });
    return true;
  }

  else if (msg.type === 'enabled') {
    setEnabledSearch(msg.enable);
    if (msg.enable) {
      getTabId_Then(tabId => {
        getState_Then(state => {

          saveState(state, tabId);
          //sendResponse({ start: true });
          //});
        });
      });
      return true;
    } else {

      getTabId_Then(tabId => {
        getState_Then(state => {
          saveState(state, tabId);
          sendResponse({});
        });
      });
      return true;
    }
  }
  else if (msg.action === 'contentJsLoaded') {
    getTabId_Then(tabId => {
      getState_Then(state => {
        let enabled = false;
        state.loadedScript = false;
        state.enabled = enabled;
        setEnabledSearch(enabled);
        saveState(state, tabId);
      });
    });
  }
  else if (msg.action === 'loadScripts') {
    getTabId_Then(tabId => {
      getState_Then(state => {
        chrome.tabs.executeScript(state.tabId, {
          file: '/js/chart.min.js'
        });
        chrome.tabs.executeScript(state.tabId, {
          file: '/js/ajaxhook.min.js'
        });
        chrome.tabs.executeScript(state.tabId, {
          file: '/js/chartlab.min.js'
        });
        chrome.tabs.executeScript(state.tabId, {
          file: '/dependencies/jquery-3.6.0.min.js'
        });
      });
    });
    return true;
  }

});

function getActiveTab(callback) {
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    var tab = activeTabId;
    if (tabs != undefined && tabs.length > 0) {
      tab = tabs[0].id;
    }
    //var tab = tabs[0];

    if (tab) {
      callback(tab);
    } else {
      chrome.tabs.get(activeTabId, function (tab) {
        if (tab) {
          callback(tab.id);
        } else {
          console.log('No active tab identified.');
        }
      });

    }
  });
}


chrome.tabs.onUpdated.addListener(function (tabId, info) {
  activeTabId = tabId;
  if (info.status === 'loading') {
    let document_url = (info.url || '').replace(/(#|\?).+/g, ''); // ignore after ?, url is updated when using facets or doing searches.
    // if we change location, we want to reset this tab state.
    let state = getState(tabId);
    if (document_url && state.document_url !== document_url) {
      //resetState(tabId);
      let enabled = false;
      setEnabledSearch(enabled);
      saveState({ document_url, enabled }, tabId);
    }
  }
  else if (info.status === 'complete') {
    //saveState({ ready: true }, tabId);
    //resetState(tabId);
    getState_Then(state => {
      let msg = {
        type: "enabled",
        global: state
      };
      setEnabledSearch(state.enabled);
      //if (state.enabled) chrome.tabs.sendMessage(tabId, msg);
    });
  }
  return true;
});

let decodeRaw = function (raw) {
  let rawString = '';
  if (raw && raw.length) {
    /*rawString = raw.map(function(data) {
      return decodeURIComponent(String.fromCharCode.apply(null, new Uint8Array(data.bytes)));
    }).join('');*/
    rawString = decodeURIComponent(new TextDecoder('utf-8').decode(raw[0].bytes));
    /*    
    try {
      let totalLen = 0;
      let aUint8 = raw.map(r => {
        let a = new Uint8Array(r.bytes);
        totalLen += a.length;
        return a;
      });

      let c = new (aUint8[0].constructor)(totalLen);
      let len = 0;
      aUint8.forEach(a => {
        c.set(a, len);
        len += a.length;
      });
      rawString = decodeURIComponent(String.fromCharCode.apply(null, c));
    }
    catch (e) {
      console.error('decodeRaw Error: ', e);
    }*/
  }

  return (rawString || '');
};

function cleanPosted(object) {
  Object.keys(object).map(attr => {
    if (typeof object[attr] === 'string' || object[attr] instanceof String) {
      object[attr] = sanitize(object[attr]);
    }
  });
  return object;
}

function getParameterCaseInsensitive(object, key) {
  let found = undefined;
  found = object[Object.keys(object).filter(function (k) {
    //console.log(k+'==>'+key);
    //if (k.toLowerCase() == key.toLowerCase()) console.log('EQUAL');
    return k.toLowerCase() == key.toLowerCase();
  })[0]];
  return found;
}

let getData = function (raw, formData, events) {
  let postedString = {};
  if (raw) {
    let decode = decodeRaw(raw);
    //Is it JSON?
    try {
      postedString = JSON.parse(decode);
    } catch (e) {
      //it is not JSON, so split it by &
      //Create a fake url
      let url = `https://www.coveo.com?${decode}`;
      postedString = getURLParams(url);
    }
    //Check if postedString is an array, if so correct it
    if (Array.isArray(postedString)) {
      postedString = postedString[0];
    }

  }
  //We want everything
  //var myquery = {};
  //'q,aq,dq,lq,filterField,partialMatch,context,pipeline'.split(',').forEach(attr => {
  Object.keys(formData).map(attr => {
    if (formData[attr] !== undefined) {
      // add all formData.q and formData.aq as q=... and aq=... to postedString
      //postedString += ` ${attr}=${formData[attr]}`;
      //postedString[attr]=formData[attr];
      //if (formData[attr][0].indexOf('[')==0){
      try {
        //myquery[attr] = JSON.parse(formData[attr][0]);
        postedString[attr] = JSON.parse(formData[attr][0]);
      }
      catch {
        //myquery[attr] = formData[attr][0];
        postedString[attr] = formData[attr][0];
      }
    }
  });
  if (events != undefined) {

    Object.assign(postedString, events);
  }
  return postedString;
}

function sanitize(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/ig;
  if (string.replace) {
    return string.replace(reg, (match) => (map[match]));
  } else {
    return string;
  }
}


function getURLParams(url) {
  //Fix relative url's
  if (!url.startsWith('http')) {
    url = 'https://platform.coveo.com' + url;
  }

  let newurl = new URL(url);
  let params = new URLSearchParams(newurl.search);
  const result = {}
  for (const [key, value] of params) { // each 'entry' is a [key, value] tupple
    result[key] = value;
  }
  return result;
}


let onSearchRequest = function (details) {
  let newurl = '';
  if (details.method == "OPTIONS" || (details.method == "GET" && details.url.indexOf('/querySuggest') == -1)) return;
  if (details.url.indexOf('cloud.coveo.com:443%22') != -1) return;

  if (details.url.indexOf('/html?uniqueId') > 0) return;
  if (details.url.indexOf('/analytics/') > 0) return;
  if (details.url.indexOf('/log?') > 0) return;
  if (details.url.indexOf('/values/batch?') > 0) return;
  if (details.url.indexOf('/plan?') > 0) return;
  let events = {};
  let newraw = [];
  events = getURLParams(details.url);
  //Add debug=true to the request
  //Can only work if debug is not in the body request!!!
  //remove debug from raw data
  let raw = details.requestBody && details.requestBody.raw;
  let postedString = getData(raw, {}, events);
  let doDebug = true;
  let debugIsProperly = true;
  if ('debug' in postedString) {
    doDebug = false;
    if (postedString['debug'] == false) {
      debugIsProperly = false;
    }
  }
  if (details.url.indexOf("CRSreq=") == -1) {
    console.log('Adding debug=true');
    let url = details.url;
    if (url.indexOf('?') == -1) {
      if (doDebug) {
        url = url + '?debug=true&CRSreq=' + details.requestId;
      }
      else {
        url = url + '?CRSreq=' + details.requestId;
      }
    } else {
      //check if debug is already there
      let adddebug = '';
      if (url.indexOf('debug=') == -1) {
        adddebug = '&debug=true';
      } else {
        if (url.indexOf('debug=false') != -1) {
          url = url.replace('debug=false', 'debug=true');
        }
      }
      if (!doDebug) {
        adddebug = '';

      }
      url = url + adddebug + '&CRSreq=' + details.requestId;
    }
    newurl = url;
  }

  //return {redirectUrl: url };
  getState_Then(state => {
    if (details.url.indexOf("CRSreq=") == -1) return;
    if (!state.enabled) return;
    // if (details.statusCode) {
    //   saveState(state, state.tabId);
    //   //return;
    // }
    if (!doDebug && !debugIsProperly && !state.warningSent) {
      state.warningSent = true;
      saveState(state, state.tabId);
      let msg = {
        type: "errordebug",
        global: state
      };
      chrome.tabs.sendMessage(state.tabId, msg);

    }

    // saveState(thisState, state.tabId);

  });
  if (newurl == '') {
    return { cancel: false };
  } else
    return { redirectUrl: newurl };
};


let addReq = function (details) {
  details.requestHeaders = details.requestHeaders.filter(rh => rh.name !== 'CSReq');
  details.requestHeaders.push({ name: 'CSReq', value: details.requestId });
  return { requestHeaders: details.requestHeaders };
}

function listener(details) {
  let filter = chrome.webRequest.filterResponseData(details.requestId);
  filter.ondata = event => {
    console.log('Filter data:');
    console.log(event);
    console.log(`filter.ondata received ${event.data.byteLength} bytes`);
    filter.write(event.data);
  };
  filter.onstop = event => {
    // The extension should always call filter.close() or filter.disconnect()
    // after creating the StreamFilter, otherwise the response is kept alive forever.
    filter.close();
  };
}

function addAllListeners() {
  //check if listener is already there
  if (chrome.webRequest.onBeforeRequest.hasListener(onSearchRequest)) {
    return;
  }
  chrome.webRequest.onBeforeRequest.addListener(onSearchRequest, FILTER_SEARCH, ['blocking', 'requestBody', "extraHeaders"]);
  //chrome.webRequest.onBeforeRequest.addListener(listener, FILTER_SEARCH, ['blocking', 'requestBody', "extraHeaders"]);
  chrome.webRequest.onCompleted.addListener(onSearchRequest, FILTER_SEARCH, ['responseHeaders']);

}

function removeAllListeners() {
  if (chrome.webRequest.onBeforeRequest.hasListener(onSearchRequest)) {

    chrome.webRequest.onBeforeRequest.removeListener(onSearchRequest);
    //chrome.webRequest.onBeforeRequest.removeListener(listener);
    chrome.webRequest.onCompleted.removeListener(onSearchRequest);
  }
}


chrome.tabs.onActivated.addListener(function (activeInfo) {
  activeTabId = activeInfo.tabId;
  getState_Then(state => {
    if (state.enabled) {
      addAllListeners();
      chrome.browserAction.setIcon({ path: './images/80 B rounded square.png' })
      chrome.browserAction.setBadgeText({ text: '🏸🔴' })

    } else {
      removeAllListeners();
      chrome.browserAction.setIcon({ path: './images/80 B rounded square.png' })
      chrome.browserAction.setBadgeText({ text: '🏸❚❚' })

    }
  });
});

chrome.browserAction.setIcon({ path: './images/80 B rounded square.png' });
//chrome.browserAction.setBadgeBackgroundColor({ color: '#1372EC' });
chrome.browserAction.setBadgeBackgroundColor({ color: [16, 232, 70, 100] });
chrome.browserAction.setBadgeText({ text: '🏸❚❚' });

function setEnabledSearch(enabled) {
  saveState({
    enabled: enabled,
  });

  if (enabled) {
    addAllListeners();
    chrome.browserAction.setIcon({ path: './images/80 B rounded square.png' })
    chrome.browserAction.setBadgeText({ text: '🏸🔴' })

  } else {
    removeAllListeners();
    chrome.browserAction.setIcon({ path: './images/80 B rounded square.png' })
    chrome.browserAction.setBadgeText({ text: '🏸❚❚' })

  }
}

//for Search tokens

chrome.browserAction.onClicked.addListener(function (tab) {
  getState_Then(state => {
    state.enabled = !state.enabled;
    setEnabledSearch(state.enabled);
    saveState(state, state.tabId);
    //check if we need to load the script
    if (state.loadedScript == false) {
      // chrome.tabs.executeScript(state.tabId, {
      //   file: '/js/chart.min.js'
      // });
      // chrome.tabs.executeScript(state.tabId, {
      //   file: '/dependencies/jquery-3.6.0.min.js'
      // });
      state.loadedScript = true;
      saveState(state, state.tabId);

    }
    let msg = {
      type: "enabled",
      global: state
    };
    chrome.tabs.sendMessage(state.tabId, msg);
  });
  //chrome.tabs.executeScript(null, {file: "testScript.js"});
});

chrome.runtime.onMessage.addListener(

);

