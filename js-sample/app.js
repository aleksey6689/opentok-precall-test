/**
* Replace these with your OpenTok API key, a session ID for a routed OpenTok session,
* and a token that has the publish role:
*/

var API_KEY = '';
var SESSION_ID = '';
var TOKEN = '';

var TEST_TIMEOUT_MS = 5000; // 5 seconds
var TEST_AUDIO_ONLY_TIMEOUT_MS = 5000; // 5 seconds

var VIDEO_MIN_BITRATE = 250000; // 250 Kbps
var VIDEO_MAX_PACKET_LOSS = 0.03; // 3%
var AUDIO_MIN_BITRATE = 25000; // 25 Kbps
var AUDIO_MAX_PACKET_LOSS = 0.05; // 5%

var publisherEl = document.createElement('div');
var subscriberEl = document.createElement('div');

var session;
var publisher;
var subscriber;
var statusContainerEl;
var statusMessageEl;
var statusIconEl;
var statusVideoBitrateEl;
var statusVideoPacketLossEl;
var statusAudioBitrateEl;
var statusAudioPacketLossEl;

var testStreamingCapability = function(subscriber, callback) {
  performQualityTest({subscriber: subscriber, timeout: TEST_TIMEOUT_MS}, function(error, results) {
    console.log('Test concluded', results);

    var audioVideoSupported = results.video.bitsPerSecond > VIDEO_MIN_BITRATE &&
      results.video.packetLossRatioPerSecond < VIDEO_MAX_PACKET_LOSS &&
      results.audio.bitsPerSecond > AUDIO_MIN_BITRATE &&
      results.audio.packetLossRatioPerSecond < AUDIO_MAX_PACKET_LOSS;

    if (audioVideoSupported) {
      return callback(false, {
        text: 'You\'re all set!',
        icon: 'assets/icon_tick.svg',
        results: results
      });
    }

    var videoResults = results.video;

    // try audio only to see if it reduces the packet loss
    setText(
      statusMessageEl,
     'Trying audio only'
   );

    publisher.publishVideo(false);

    performQualityTest({subscriber: subscriber, timeout: TEST_AUDIO_ONLY_TIMEOUT_MS}, function(error, results) {
      var audioSupported = results.audio.bitsPerSecond > AUDIO_MIN_BITRATE &&
          results.audio.packetLossRatioPerSecond < AUDIO_MAX_PACKET_LOSS;

      results.video = videoResults;

      if (audioSupported) {
        return callback(false, {
          text: 'Your bandwidth can support audio only',
          icon: 'assets/icon_warning.svg',
          results: results
        });
      }

      return callback(false, {
        text: 'Your bandwidth is too low for audio',
        icon: 'assets/icon_error.svg',
        results: results
      });
    });
  });
};

var callbacks = {
  onInitPublisher: function onInitPublisher(error) {
    if (error) {
      setText(statusMessageEl, 'Could not acquire your camera');
      return;
    }

    setText(statusMessageEl, 'Connecting to session');
  },

  onPublish: function onPublish(error) {
    if (error) {
      // handle publishing errors here
      setText(
        statusMessageEl,
        'Could not publish video'
      );
      return;
    }

    setText(
      statusMessageEl,
      'Subscribing to video'
    );

    subscriber = session.subscribe(
      publisher.stream,
      subscriberEl,
      {
        audioVolume: 0,
        testNetwork: true
      },
      callbacks.onSubscribe
    );
  },

  cleanup: function() {
    session.unsubscribe(subscriber);
    session.unpublish(publisher);
  },

  onSubscribe: function onSubscribe(error, subscriber) {
    if (error) {
      setText(statusMessageEl, 'Could not subscribe to video');
      return;
    }

    setText(statusMessageEl, 'Checking your available bandwidth');

    testStreamingCapability(subscriber, function(error, message) {
      setText(statusMessageEl, message.text);
      setResultNumbers(message.results);
      statusIconEl.src = message.icon;
      callbacks.cleanup();
    });
  },

  onConnect: function onConnect(error) {
    if (error) {
      setText(statusMessageEl, 'Could not connect to OpenTok');
    }
  }
};

compositeOfCallbacks(
  callbacks,
  ['onInitPublisher', 'onConnect'],
  function(error) {
    if (error) {
      return;
    }

    setText(statusMessageEl, 'Publishing video');
    session.publish(publisher, callbacks.onPublish);
  }
);

document.addEventListener('DOMContentLoaded', function() {
  var container = document.createElement('div');
  container.className = 'container';

  container.appendChild(publisherEl);
  container.appendChild(subscriberEl);
  document.body.appendChild(container);

  // This publisher uses the default resolution (640x480 pixels) and frame rate (30fps).
  // For other resoultions you may need to adjust the bandwidth conditions in
  // testStreamingCapability().

  publisher = OT.initPublisher(publisherEl, {}, callbacks.onInitPublisher);

  session = OT.initSession(API_KEY, SESSION_ID);
  session.connect(TOKEN, callbacks.onConnect);
  statusContainerEl = document.getElementById('status_container');
  statusMessageEl = document.getElementById('message');
  statusIconEl = statusContainerEl.querySelector('img');
  statusVideoBitrateEl = document.getElementById('videoBitrate');
  statusVideoPacketLossEl = document.getElementById('videoPacketLoss');
  statusAudioBitrateEl = document.getElementById('audioBitrate');
  statusAudioPacketLossEl = document.getElementById('audioPacketLoss');
});

// Helpers
function setText(el, text) {
  if (!el) {
    return;
  }

  if (el.textContent) {
    el.textContent = text;
  }

  if (el.innerText) {
    el.innerText = text;
  }
}

// Helpers
function setResultNumbers(results) {
  statusVideoBitrateEl.innerHTML = '<strong>Video Bitrate: </strong>' + getBitrateStr(results.video.bitsPerSecond);
  var statusVideoBitrateClass = (results.video.bitsPerSecond >= VIDEO_MIN_BITRATE) ? "success" : "danger";
  statusVideoBitrateEl.setAttribute("class", "alert-" + statusVideoBitrateClass);

  statusVideoPacketLossEl.innerHTML = '<strong>Video Packet Loss: </strong>' + getPacketLossStr(results.video.packetLossRatioPerSecond);
  var statusVideoPacketLossClass = (results.video.packetLossRatioPerSecond <= VIDEO_MAX_PACKET_LOSS) ? "success" : "danger";
  statusVideoPacketLossEl.setAttribute("class", "alert-" + statusVideoPacketLossClass);

  statusAudioBitrateEl.innerHTML = '<strong>Audio Bitrate: </strong>' + getBitrateStr(results.audio.bitsPerSecond);
  var statusAudioBitrateClass = (results.audio.bitsPerSecond >= AUDIO_MIN_BITRATE) ? "success" : "danger";
  statusAudioBitrateEl.setAttribute("class", "alert-" + statusAudioBitrateClass);

  statusAudioPacketLossEl.innerHTML = '<strong>Audio Packet Loss: </strong>' + getPacketLossStr(results.audio.packetLossRatioPerSecond);
  var statusAudioPacketLossClass = (results.audio.packetLossRatioPerSecond <= AUDIO_MAX_PACKET_LOSS) ? "success" : "danger";
  statusAudioPacketLossEl.setAttribute("class", "alert-" + statusAudioPacketLossClass);
}

function getBitrateStr(num) {
  return (num / 1000).toFixed(2) + ' Kbps';
} 

function getPacketLossStr(num) {
  return (num * 100).toFixed(2) + '%';
} 

function pluck(arr, propertName) {
  return arr.map(function(value) {
    return value[propertName];
  });
}

function sum(arr, propertyName) {
  if (typeof propertyName !== 'undefined') {
    arr = pluck(arr, propertyName);
  }

  return arr.reduce(function(previous, current) {
    return previous + current;
  }, 0);
}

function max(arr) {
  return Math.max.apply(undefined, arr);
}

function min(arr) {
  return Math.min.apply(undefined, arr);
}

function calculatePerSecondStats(statsBuffer, seconds) {
  var stats = {};
  ['video', 'audio'].forEach(function(type) {
    stats[type] = {
      packetsPerSecond: sum(pluck(statsBuffer, type), 'packetsReceived') / seconds,
      bitsPerSecond: (sum(pluck(statsBuffer, type), 'bytesReceived') * 8) / seconds,
      packetsLostPerSecond: sum(pluck(statsBuffer, type), 'packetsLost') / seconds
    };
    stats[type].packetLossRatioPerSecond = (
      stats[type].packetsLostPerSecond / stats[type].packetsPerSecond
    );
  });

  stats.windowSize = seconds;
  return stats;
}

function getSampleWindowSize(samples) {
  var times = pluck(samples, 'timestamp');
  return (max(times) - min(times)) / 1000;
}

if (!Array.prototype.forEach) {
  Array.prototype.forEach = function(fn, scope) {
    for (var i = 0, len = this.length; i < len; ++i) {
      fn.call(scope, this[i], i, this);
    }
  };
}

function compositeOfCallbacks(obj, fns, callback) {
  var results = {};
  var hasError = false;

  var checkDone = function checkDone() {
    if (Object.keys(results).length === fns.length) {
      callback(hasError, results);
      callback = function() {};
    }
  };

  fns.forEach(function(key) {
    var originalCallback = obj[key];

    obj[key] = function(error) {
      results[key] = {
        error: error,
        args: Array.prototype.slice.call(arguments, 1)
      };

      if (error) {
        hasError = true;
      }

      originalCallback.apply(obj, arguments);
      checkDone();
    };
  });
}

function bandwidthCalculatorObj(config) {
  var intervalId;

  config.pollingInterval = config.pollingInterval || 500;
  config.windowSize = config.windowSize || 2000;
  config.subscriber = config.subscriber || undefined;

  return {
    start: function(reportFunction) {
      var statsBuffer = [];
      var last = {
        audio: {},
        video: {}
      };

      intervalId = window.setInterval(function() {
        config.subscriber.getStats(function(error, stats) {
          var snapshot = {};
          var nowMs = new Date().getTime();
          var sampleWindowSize;

          ['audio', 'video'].forEach(function(type) {
            snapshot[type] = Object.keys(stats[type]).reduce(function(result, key) {
              result[key] = stats[type][key] - (last[type][key] || 0);
              last[type][key] = stats[type][key];
              return result;
            }, {});
          });

          // get a snapshot of now, and keep the last values for next round
          snapshot.timestamp = stats.timestamp;

          statsBuffer.push(snapshot);
          statsBuffer = statsBuffer.filter(function(value) {
            return nowMs - value.timestamp < config.windowSize;
          });

          sampleWindowSize = getSampleWindowSize(statsBuffer);

          if (sampleWindowSize !== 0) {
            reportFunction(calculatePerSecondStats(
              statsBuffer,
              sampleWindowSize
            ));
          }
        });
      }, config.pollingInterval);
    },

    stop: function() {
      window.clearInterval(intervalId);
    }
  };
}

function performQualityTest(config, callback) {
  var startMs = new Date().getTime();
  var testTimeout;
  var currentStats;

  var bandwidthCalculator = bandwidthCalculatorObj({
    subscriber: config.subscriber
  });

  var cleanupAndReport = function() {
    currentStats.elapsedTimeMs = new Date().getTime() - startMs;
    callback(undefined, currentStats);

    window.clearTimeout(testTimeout);
    bandwidthCalculator.stop();

    callback = function() {};
  };

  // bail out of the test after 30 seconds
  window.setTimeout(cleanupAndReport, config.timeout);

  bandwidthCalculator.start(function(stats) {
    console.log(stats);

    // you could do something smart here like determine if the bandwidth is
    // stable or acceptable and exit early
    currentStats = stats;
  });
}
