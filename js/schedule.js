function Schedule(options) {
    var schedule = {};
    
    schedule.init = function(options) {
        schedule.sourceJSON = 'sessions.json';
        schedule.$container = $('#schedule');
        schedule.$toggles = $('<ul id="schedule-controls">').appendTo('header').hide();
        schedule.tabs = [
            { name: 'Thursday', tabDate: new Date(2014,6,24) },
            { name: 'Friday', tabDate: new Date(2014,6,25) }
        ];
        schedule.sessionList = [];
        if (Modernizr.localstorage) {
            localStorage['srccon_saved_sessions'] = localStorage['srccon_saved_sessions'] || '';
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
            case "_session":
                schedule.getSessionDetail(pageID);
                break;
            case "_show":
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
        if (schedule.sessionList.length) {
            schedule.sortSessionGroups(schedule.sessionList);
            if (callback) {
                callback();
            }
        } else {
            $.getJSON(schedule.sourceJSON)
                .done(function(results) {
                    schedule.sortSessionGroups(results);
                    schedule.updateSavedSessionList();
                    if (callback) {
                        callback();
                    }
                });
        }
    }

    schedule.sortSessionGroups = function(data) {
        schedule.sessionList = _.sortBy(data, function(i) {
            return i.length != '1 hour';
        })
    }
    
    schedule.addSessionsToSchedule = function(sessionList) {
        var sessionList = sessionList || schedule.sessionList;
        var addSession = function (targetBlock, templateData) {
            targetBlock.find('.open-block').remove();
            targetBlock.append(schedule.sessionListItemTemplate(templateData));
        }

        _.each(sessionList, function(v, k) {
            var templateData = {
                sessionID: v.id,
                sessionName: schedule.formatPrettyText(v.title),
                sessionTime: v.time,
                sessionRoom: schedule.formatPrettyText(v.room),
                sessionClass: v.everyone ? 'everyone' : v.length == '1 hour' ? 'length-short' : 'length-long'
            }
            
            // write session into proper schedule block
            var targetBlock = $('#'+v.scheduleblock);
            addSession(targetBlock, templateData);

            // for long sessions, add ghost to next block as well
            if (v.length == '2.5 hours') {
                templateData.sessionID += '-ghost';
                templateData.sessionClass += ' session-ghost';

                var targetBlock = $('#'+v.scheduleblock.replace('-1','-2'));
                addSession(targetBlock, templateData);
            }
        });
        
        schedule.addStars('.session-list-item');
    }
    
    // Session detail
    schedule.showSessionDetail = function() {
        var session = _.find(schedule.sessionList, function(i) {
            return i.id == schedule.sessionID;
        })

        if (session) {
            var templateData = {
                'session': session,
                'formatMultiline': schedule.formatMultiline,
                'formatPrettyText': schedule.formatPrettyText
            }
            
            schedule.$container.append(schedule.sessionDetailTemplate(templateData));
            schedule.addStars('.session-detail');
        } else {
            schedule.makeSchedule();
        }
    }

    schedule.clearSessionDetail = function() {
        $('#session-detail-wrapper').remove();
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
        var newURL = (!!value) ? baseURL + "#_" + value : baseURL;
        
        window.history.pushState(value, "", newURL);
        window.history.ready = true;
    }
    
    // Display utilities
    schedule.transitionElementIn = function(element) {
        element.fadeIn(50);
    }
    
    schedule.addStars = function(containerClass) {
        if (Modernizr.localstorage) {
            $(containerClass+':not(.session-everyone)').append('<span class="favorite"><i class="fa fa-star"></i></span>');
            _.each(schedule.savedSessionIDs, function(i) {
                $('[data-session="' + i + '"]').find('.favorite').addClass('favorite-active');
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
            return (!!v.everyone) || _.contains(schedule.savedSessionIDs, v.id);
        });
    }
    
    // Listeners
    schedule.addListeners = function() {
        // open session detail view
        schedule.$container.on('click', '.session-list-item', function(e) {
            var clicked = $(this).data('session');

            schedule.updateHash('session-'+clicked);
            schedule.getSessionDetail(clicked);
        });

        // return to full schedule from session detail view
        schedule.$container.on('click', '#show-full-schedule', function(e) {
            e.preventDefault();
            
            if (window.history.ready) {
                window.history.back();
            } else {
                schedule.updateHash('');
                schedule.clearSessionDetail();
                schedule.makeSchedule();
            }
        });

        // favoriting via localstorage
        schedule.$container.on('click', '.favorite', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            var clicked = $(this);
            var sessionID = clicked.parent().data('session').toString();
            var targets = $('[data-session="' + sessionID + '"]').find('.favorite');

            targets.toggleClass('favorite-active');
            if (clicked.hasClass('favorite-active')) {
                schedule.savedSessionIDs.push(sessionID);
            } else {
                schedule.savedSessionIDs = _.without(schedule.savedSessionIDs, sessionID);
                if (schedule.chosenTab == 'favorites') {
                    targets.parent('.session-list-item').fadeOut('fast', function() {
                        var target = $(this);
                        var targetBlock = target.parents('.page-block');
                        target.remove();
                        if (!targetBlock.find('.session-list-item').length) {
                            targetBlock.append('<div class="open-block">OPEN</div>');
                        }
                    });
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
            if (!window.history.ready) return;
            schedule.clearSessionDetail();
            schedule.load();
        };

        // check for new appcache on page load
        window.addEventListener('load', function(e) {
            window.applicationCache.addEventListener('updateready', function(e) {
                if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
                    // new appcache downloaded
                    if (confirm('A new version of the schedule is available. Load it?')) {
                        window.location.reload();
                    }
                }
            }, false);
        }, false);
    }

    // Text formatting
    schedule.formatMultiline = function(str) {
        return str.replace(RegExp('\\n', 'g'),'<br>');
    }
    
    schedule.formatPrettyText = function(str) {
        return str
            // opening single quotes
            .replace(/(^|[-\u2014\s(\["])'/g, "$1\u2018")
            // closing single quotes & apostrophes
            .replace(/'/g, "\u2019")
            // opening double quotes
            .replace(/(^|[-\u2014/\[(\u2018\s])"/g, "$1\u201c")
            // closing double quotes
            .replace(/"/g, "\u201d")
            // em dashes
            .replace(/--/g, "\u2014");
    }

    // Underscore templates
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