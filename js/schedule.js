function Schedule(options) {
    var schedule = {};
    
    schedule.init = function(options) {
        schedule.sourceJSON = 'sessions.json';
        schedule.$container = $('#schedule');
        schedule.$toggles = $('<ul>').appendTo('#schedule-controls').hide();
        schedule.tabs = [
            { name: 'Thursday', tabDate: new Date(2014,6,24) },
            { name: 'Friday', tabDate: new Date(2014,6,25) }
        ];
        schedule.sessionList = [];
        if (Modernizr.localstorage) {
            schedule.savedSessionIDs = _.compact(localStorage['srccon_saved_sessions'].split(',')) || [];
        }

        schedule.addListeners();
        schedule.addToggles();
        schedule.getChosenTab();
        schedule.load();
    }

    schedule.load = function() {
        if (!window.location.hash) {
            // load base schedule
            schedule.makeSchedule();
        } else {
            // load relevant detail page
            var hashArray = window.location.hash.substring(1).split('-');
            schedule.route(hashArray[0], hashArray[1])
        }
    }
    
    schedule.route = function(pageType, pageID) {
        switch(pageType) {
            case "session":
                schedule.getSessionDetail(pageID);
                break;
            case "show":
                schedule.chosenTab = pageID;
                schedule.makeSchedule();
                break;
        }
    }

    // Session lists
    schedule.makeSchedule = function() {
        schedule.loadChosenTab();
        schedule.$toggles.show();
    }

    schedule.loadSessions = function(callback) {
        $.getJSON(schedule.sourceJSON)
            .done(function(results) {
                schedule.sortSessionGroups(results);
                schedule.updateSavedSessionList();
                if (callback) {
                    callback();
                }
            });
    }

    schedule.sortSessionGroups = function(data) {
        schedule.sessionList = _.sortBy(data, function(i) {
            return i.hour_idealsessionlength != '1';
        })
    }
    
    schedule.addSessionsToSchedule = function(sessionList) {
        var sessionList = sessionList || schedule.sessionList;

        _.each(sessionList, function(v, k) {
            var templateData = {
                sessionID: v.id,
                sessionName: v.sessiontitle,
                sessionTime: 'Time block',
                sessionRoom: 'Room name',
                sessionClass: v.everyone ? 'everyone' : v.hour_idealsessionlength == '1' ? 'length-short' : 'length-long'
            }

            $('#'+v.slot).find('.open-block').remove();
            $('#'+v.slot).append(schedule.sessionListItemTemplate(templateData));
        });
        
        schedule.addStars();
    }
    
    // Session detail
    schedule.showSessionDetail = function() {
        var session = _.find(schedule.sessionList, function(i) {
            return i.id == schedule.sessionID;
        })

        if (session) {
            schedule.$toggles.hide();
            schedule.$container.hide().empty().append(schedule.sessionDetailTemplate({'session': session}));
            schedule.transitionElementIn(schedule.$container);
        } else {
            schedule.makeSchedule();
        }
    }
    
    schedule.getSessionDetail = function(sessionID) {
        schedule.sessionID = sessionID;
        
        if (schedule.sessionList.length) {
            schedule.showSessionDetail();
        } else {
            schedule.loadSessions(schedule.showSessionDetail);
        }
    }

    // Hash utilities
    schedule.updateHash = function(value) {
        var baseURL = window.location.href.replace(window.location.hash, '');
        var newURL = (!!value) ? baseURL + "#" + value : baseURL;
        
        window.history.pushState(value, "", newURL);
    }
    
    // Display utilities
    schedule.transitionElementIn = function(element) {
        element.fadeIn(50);
    }
    
    schedule.addStars = function() {
        if (Modernizr.localstorage) {
            $('.session-list-item').append('<span class="favorite">&#9733;</span>');
            _.each(schedule.savedSessionIDs, function(i) {
                $('#session-'+i).find('.favorite').addClass('favorite-active');
            })
        }
    }
    
    schedule.addToggles = function() {
        if (Modernizr.localstorage) {
            schedule.tabs.push({ name: 'Favorites' });
        }
        
        var toggleWidth = (1 / schedule.tabs.length) * 100;

        _.each(_.pluck(schedule.tabs, 'name'), function(i) {
            schedule.$toggles.append(
                $('<li>').css('width', toggleWidth+'%').append(
                    $('<a>').text(i).attr('href', '#').attr('id', 'show-'+i.toLowerCase())
                )
            );
        });
    }
    
    schedule.getChosenTab = function() {
        if (!schedule.chosenTab) {
            var today = new Date().toDateString();
            var favoredTab = _.find(schedule.tabs, function(i) {
                return (!i.tabDate) ? false : i.tabDate.toDateString() == today
            })
        
            if (favoredTab) {
                schedule.chosenTab = favoredTab.name.toLowerCase();
            } else {
                schedule.chosenTab = schedule.tabs[0].name.toLowerCase();
            }
        }
    }
    
    schedule.loadChosenTab = function() {
        schedule.$toggles.find('a').removeClass('active');
        $('#show-'+schedule.chosenTab).addClass('active');
        
        if (schedule.chosenTab == 'favorites') {
            if (schedule.savedSessionList) {
                schedule.showFavorites();
            } else {
                schedule.loadSessions(schedule.showFavorites);
            }
        } else {
            schedule.$container.hide().empty().append(schedule.sessionListTemplate);
            schedule.loadSessions(schedule.addSessionsToSchedule);
            schedule.transitionElementIn(schedule.$container);

            schedule.$container.find('.schedule-tab').hide();
            schedule.transitionElementIn($('#'+schedule.chosenTab));
        }
    }
    
    schedule.showFavorites = function() {
        schedule.$container.hide().empty().append('<p class="overline">Star sessions to store a list on this device.</p>').append(schedule.sessionListTemplate);
        schedule.addSessionsToSchedule(schedule.savedSessionList);
        schedule.transitionElementIn(schedule.$container);
    }
    
    schedule.updateSavedSessionList = function() {
        schedule.savedSessionList = _.filter(schedule.sessionList, function(v, k) {
            return _.contains(schedule.savedSessionIDs, v.id);
        });
    }
    
    // Listeners
    schedule.addListeners = function() {
        // open session detail view
        schedule.$container.on('click', '.session-list-item', function(e) {
            var clicked = $(this).attr('id');

            schedule.updateHash(clicked);
            schedule.getSessionDetail(clicked.replace('session-',''));
        });

        // return to full schedule from session detail view
        schedule.$container.on('click', '#show-full-schedule', function(e) {
            e.preventDefault();
            
            schedule.updateHash('');
            schedule.makeSchedule();
        });

        // favoriting via localstorage
        schedule.$container.on('click', '.favorite', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            var clicked = $(this);
            var sessionID = clicked.parent().attr('id').replace('session-','');

            clicked.toggleClass('favorite-active');
            if (clicked.hasClass('favorite-active')) {
                schedule.savedSessionIDs.push(sessionID);
            } else {
                schedule.savedSessionIDs = _.without(schedule.savedSessionIDs, sessionID);
                if (schedule.chosenTab == 'favorites') {
                    clicked.parent().fadeOut('fast');
                }
            }
            localStorage['srccon_saved_sessions'] = schedule.savedSessionIDs.join();
            schedule.updateSavedSessionList();
        });

        // toggle schedule tabs
        schedule.$toggles.on('click', 'a', function(e) {
            e.preventDefault();
            
            var clicked = $(this).attr('id');
            schedule.updateHash(clicked);
            
            schedule.chosenTab = clicked.replace('show-','');
            schedule.loadChosenTab();
        });
        
        // handle back button
        window.onpopstate = function(event) {
            schedule.load();
        };
    }

    // Underscore templates
    _.templateSettings = {
        interpolate: /\{\{(.+?)\}\}/g
    };

    schedule.sessionListTemplate = _.template(
        $("script#session-list-template").html()
    );

    schedule.sessionListItemTemplate = _.template(
        $("script#session-list-item-template").html()
    );

    schedule.sessionDetailTemplate = _.template(
        $("script#session-detail-template").html()
    );

    // fight me
    schedule.init();
}

new Schedule();