// Hungarian translation provided by =Krumpli=

ScriptAPI.register('FarmGod', true, 'Warre', 'nl.tribalwars@coma.innogames.de');

window.FarmGod = {};
window.FarmGod.Library = (function () {
  /**** TribalWarsLibrary.js ****/
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () {
        if (this.queues === null) {
          this.queues = this.queueLib.createQueues(10); // Aumentar el número de colas para procesamiento más rápido
        }
      },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) {
          this.action = action;
          this.arguments = arg;
          this.promise = promise;
          this.attempts = 0;
        },
        Queue: function () {
          this.list = [];
          this.working = false;
          this.length = 0;

          this.doNext = function () {
            let item = this.dequeue();
            let self = this;

            if (item.action == 'openWindow') {
              window.open(...item.arguments).addEventListener('DOMContentLoaded', function () {
                self.start();
              });
            } else {
              $[item.action](...item.arguments).done(function () {
                item.promise.resolve.apply(null, arguments);
                self.start();
              }).fail(function () {
                item.attempts += 1;
                if (item.attempts < twLib.queueLib.maxAttempts) {
                  self.enqueue(item, true);
                } else {
                  item.promise.reject.apply(null, arguments);
                }

                self.start();
              });
            }
          };

          this.start = function () {
            if (this.length) {
              this.working = true;
              this.doNext();
            } else {
              this.working = false;
            }
          };

          this.dequeue = function () {
            this.length -= 1;
            return this.list.shift();
          };

          this.enqueue = function (item, front = false) {
            (front) ? this.list.unshift(item) : this.list.push(item);
            this.length += 1;

            if (!this.working) {
              this.start();
            }
          };
        },
        createQueues: function (amount) {
          let arr = [];

          for (let i = 0; i < amount; i++) {
            arr[i] = new twLib.queueLib.Queue();
          }

          return arr;
        },
        addItem: function (item) {
          let leastBusyQueue = twLib.queues.reduce((prev, curr) => (prev.length <= curr.length ? prev : curr));
          leastBusyQueue.enqueue(item);
        },
        orchestrator: function (type, arg) {
          let promise = $.Deferred();
          let item = new twLib.queueLib.Item(type, arg, promise);

          twLib.queueLib.addItem(item);

          return promise;
        }
      },
      ajax: function () {
        return twLib.queueLib.orchestrator('ajax', arguments);
      },
      get: function () {
        return twLib.queueLib.orchestrator('get', arguments);
      },
      post: function () {
        return twLib.queueLib.orchestrator('post', arguments);
      },
      openWindow: function () {
        let item = new twLib.queueLib.Item('openWindow', arguments);

        twLib.queueLib.addItem(item);
      }
    };

    twLib.init();
  }

  /**** Script Library ****/
  const setUnitSpeeds = function () {
    let unitSpeeds = {};

    $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
      $(xml).find('config').children().map((i, el) => {
        unitSpeeds[$(el).prop('nodeName')] = $(el).find('speed').text().toNumber();
      });

      localStorage.setItem('FarmGod_unitSpeeds', JSON.stringify(unitSpeeds));
    });
  };

  const getUnitSpeeds = function () {
    return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false;
  };

  if (!getUnitSpeeds()) setUnitSpeeds();

  const determineNextPage = function (page, $html) {
    let villageLength = ($html.find('#scavenge_mass_screen').length > 0) ? $html.find('tr[id*="scavenge_village"]').length : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html.find('.paged-nav-item').first().closest('td').find('select').first();
    // Commented out the old version of the code, updated in April 2024
    // The old version did not count the number of pages in the loot assistant properly when there were more than 15 or so due to the way the UI changes to not show all pages
    // let navLength = ($html.find('#am_widget_Farm').length > 0) ? $html.find('#plunder_list_nav').first().find('a.paged-nav-item').length : ((navSelect.length > 0) ? navSelect.find('option').length - 1 : $html.find('.paged-nav-item').not('[href*="page=-1"]').length);
    let navLength = ($html.find('#am_widget_Farm').length > 0) ? parseInt($('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item')[$('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item').length - 1].textContent.replace(/\D/g, '')) - 1 : ((navSelect.length > 0) ? navSelect.find('option').length - 1 : $html.find('.paged-nav-item').not('[href*="page=-1"]').length);
    let pageSize = ($('#mobileHeader').length > 0) ? 10 : parseInt($html.find('input[name="page_size"]').val());

    if (page == -1 && villageLength == 1000) {
      return Math.floor(1000 / pageSize);
    } else if (page < navLength) {
      return page + 1;
    }

    return false;
  };

  const processPage = function (url, page, wrapFn) {
    let pageText = (url.match('am_farm')) ? `&Farm_page=${page}` : `&page=${page}`;

    return twLib.ajax({
      url: url + pageText
    }).then((html) => {
      return wrapFn(page, $(html));
    });
  };

  const processAllPages = function (url, processorFn) {
    let page = (url.match('am_farm') || url.match('scavenge_mass')) ? 0 : -1;
    let wrapFn = function (page, $html) {
      let dnp = determineNextPage(page, $html);

      if (dnp) {
        processorFn($html);
        return processPage(url, dnp, wrapFn);
      } else {
        return processorFn($html);
      }
    };

    return processPage(url, page, wrapFn);
  };

  const getDistance = function (origin, target) {
    let a = origin.toCoord(true).x - target.toCoord(true).x;
    let b = origin.toCoord(true).y - target.toCoord(true).y;

    return Math.hypot(a, b);
  };

  const subtractArrays = function (array1, array2) {
    let result = array1.map((val, i) => {
      return val - array2[i];
    });

    return (result.some(v => v < 0)) ? false : result;
  };

  const getCurrentServerTime = function () {
    let [hour, min, sec, day, month, year] = $('#serverTime').closest('p').text().match(/\d+/g);
    return new Date(year, (month - 1), day, hour, min, sec).getTime();
  };

  const timestampFromString = function (timestr) {
    let d = $('#serverDate').text().split('/').map(x => +x);
    let todayPattern = new RegExp(window.lang['aea2b0aa9ae1534226518faaefffdaad'].replace('%s', '([\\d+|:]+)')).exec(timestr);
    let tomorrowPattern = new RegExp(window.lang['57d28d1b211fddbb7a499ead5bf23079'].replace('%s', '([\\d+|:]+)')).exec(timestr);
    let laterDatePattern = new RegExp(window.lang['0cb274c906d622fa8ce524bcfbb7552d'].replace('%1', '([\\d+|\\.]+)').replace('%2', '([\\d+|:]+)')).exec(timestr);
    let t, date;

    if (todayPattern !== null) {
      t = todayPattern[1].split(':');
      date = new Date(d[2], (d[1] - 1), d[0], t[0], t[1], t[2], (t[3] || 0));
    } else if (tomorrowPattern !== null) {
      t = tomorrowPattern[1].split(':');
      date = new Date(d[2], (d[1] - 1), (d[0] + 1), t[0], t[1], t[2], (t[3] || 0));
    } else if (laterDatePattern !== null) {
      t = laterDatePattern[2].split(':');
      let monthDay = laterDatePattern[1].split('.');
      date = new Date(d[2], (monthDay[1] - 1), monthDay[0], t[0], t[1], t[2], (t[3] || 0));
    }

    return date.getTime();
  };

  const serverTimeInMinutes = function (date) {
    return Math.floor((date - getCurrentServerTime()) / 60000);
  };

  return {
    twLib: window.twLib,
    getCurrentServerTime: getCurrentServerTime,
    serverTimeInMinutes: serverTimeInMinutes,
    timestampFromString: timestampFromString,
    subtractArrays: subtractArrays,
    getDistance: getDistance,
    processAllPages: processAllPages,
    getUnitSpeeds: getUnitSpeeds
  };
})();

window.FarmGod.Farm = (function (lib) {
  /**** Constants ****/
  const defaultConfig = {
    botProtection: false,
    haulsPerVillage: 5
  };
  const unitPreferences = {
    attack: [
      { unit: 'axe', quantity: 10 },
      { unit: 'light', quantity: 2 },
      { unit: 'ram', quantity: 1 }
    ]
  };

  /**** Utilities ****/
  const getUnitSpeed = function (unitType) {
    let unitSpeeds = lib.getUnitSpeeds();
    return (unitSpeeds && unitSpeeds[unitType]) ? unitSpeeds[unitType] : 18;
  };

  const loadConfig = function () {
    return JSON.parse(localStorage.getItem('FarmGod_Config')) || defaultConfig;
  };

  const saveConfig = function (config) {
    localStorage.setItem('FarmGod_Config', JSON.stringify(config));
  };

  /**** Farming Functions ****/
  const farmVillage = function (village, distance, index) {
    let { botProtection, haulsPerVillage } = loadConfig();
    let units = unitPreferences.attack;
    let hauls = 0;

    const sendAttack = function (unitIndex) {
      let unit = units[unitIndex];
      let coords = village.coords;
      let target = `${coords[0]}|${coords[1]}`;

      lib.twLib.post('/game.php?village=' + village.id + '&screen=place&ajax=command', {
        x: coords[0],
        y: coords[1],
        attack: 1,
        ch: $('#serverTime').attr('data-ch'),
        units: { [unit.unit]: unit.quantity }
      }).then(() => {
        hauls += 1;

        if (hauls < haulsPerVillage && unitIndex < units.length - 1) {
          setTimeout(() => sendAttack(unitIndex + 1), 500); // Reducir el tiempo de espera
        }
      });
    };

    if (!botProtection || hauls < haulsPerVillage) {
      sendAttack(0);
    }
  };

  const startFarming = function (villages) {
    let { haulsPerVillage } = loadConfig();
    let totalHauls = 0;

    villages.forEach((village, index) => {
      let distance = lib.getDistance(game_data.village.coord, village.coords);

      if (totalHauls < haulsPerVillage * villages.length) {
        farmVillage(village, distance, index);
        totalHauls += 1;
      }
    });
  };

  return {
    startFarming: startFarming,
    loadConfig: loadConfig,
    saveConfig: saveConfig
  };
})(window.FarmGod.Library);

window.FarmGod.Interface = (function (farm) {
  const config = farm.loadConfig();

  /**** UI Elements ****/
  const configButton = $('<button>').text('Config').click(() => {
    let newConfig = prompt('Enter new config:', JSON.stringify(config));
    if (newConfig) {
      farm.saveConfig(JSON.parse(newConfig));
    }
  });

  const startButton = $('<button>').text('Start Farming').click(() => {
    let villages = prompt('Enter villages (format: id,coords):', '');
    if (villages) {
      villages = villages.split(',').map(v => {
        let [id, coords] = v.split('|');
        return { id, coords: coords.split(',') };
      });
      farm.startFarming(villages);
    }
  });

  /**** UI Initialization ****/
  $('body').append(configButton, startButton);

  return {};
})(window.FarmGod.Farm);