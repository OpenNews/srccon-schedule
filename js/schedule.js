function Schedule(options) {
    var schedule = {};
    
    schedule.init = function(options) {
        schedule.offlineMode = false;
        schedule.sourceJSON = 'sessions.json';
        schedule.$container = $('#schedule');
        schedule.$toggles = $('<ul id="schedule-controls">').appendTo('header').hide();
        schedule.tabs = [
            { name: 'Thursday', tabDate: new Date(2014,6,24) },
            { name: 'Friday', tabDate: new Date(2014,6,25) },
            { name: 'All' }
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

    schedule.writeSession = function(targetBlock, templateData, template) {
        if (!template) {
            var template = schedule.sessionCardTemplate
        }
        targetBlock.find('.open-block').remove();
        targetBlock.append(template(templateData));
    }
    
    schedule.makeSessionItemTemplateData = function(sessionItem, expanded) {
        var templatedata = {
            session: sessionItem,
            sessionID: sessionItem.id,
            sessionClass: sessionItem.everyone ? 'everyone' : sessionItem.length == '1 hour' ? 'length-short' : 'length-long',
            showDay: false,
            showLeaders: false,
            smartypants: schedule.smartypants
        }
        if (expanded) {
            templatedata.showDay = true;
            templatedata.showLeaders = true;
        }
        
        return templatedata;
    }
    
    schedule.addSessionsToSchedule = function(sessionList) {
        var sessionList = sessionList || schedule.sessionList;

        _.each(sessionList, function(v, k) {
            // write session into proper schedule block
            var targetBlock = $('#'+v.scheduleblock);
            var templateData = schedule.makeSessionItemTemplateData(v);
            schedule.writeSession(targetBlock, templateData);

            // for long sessions, add ghost to next block as well
            if (v.length == '2.5 hours') {
                templateData.sessionID += '-ghost';
                templateData.sessionClass += ' session-ghost';

                var targetBlock = $('#'+v.scheduleblock.replace('-1','-2'));
                schedule.writeSession(targetBlock, templateData);
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
                session: session,
                smartypants: schedule.smartypants
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
            schedule.tabs.splice(schedule.tabs.length-1, 0, { name: 'Favorites' });
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
            schedule.$container.removeClass().addClass('favorites');
            if (schedule.savedSessionList) {
                schedule.showFavorites();
            } else {
                schedule.loadSessions(schedule.showFavorites);
            }
        } else if (schedule.chosenTab == 'all') {
            schedule.$container.removeClass().addClass('all-sessions');
            schedule.loadSessions(schedule.showFullSessionList);
        } else {
            schedule.$container.removeClass();
            schedule.$container.hide().empty().append(schedule.sessionListTemplate);
            schedule.loadSessions(schedule.addSessionsToSchedule);
            schedule.transitionElementIn(schedule.$container);
            
            schedule.$container.find('.schedule-tab').hide();
            schedule.transitionElementIn($('#'+schedule.chosenTab));
        }
    }
    
    schedule.showFullSessionList = function() {
        schedule.$container.hide().empty();
        schedule.addListControls();

        var fullList = _.reject(schedule.sessionList, function(i) {
            return i.everyone;
        });
        fullList = _.sortBy(fullList, function(i) {
            return i.title;
        });
        
        _.each(fullList, function(v, k) {
            var templateData = schedule.makeSessionItemTemplateData(v, true);
            schedule.writeSession(schedule.$container, templateData, schedule.sessionListItemTemplate);
        });
        
        schedule.addStars('.session-list-item');
        schedule.transitionElementIn(schedule.$container);
    }
    
    schedule.addListControls = function() {
        var filterForm = '<div id="filter-form">\
                <label for="list-filter">Search names, leaders and descriptions</label>\
                <input class="filter" type="text" id="list-filter" />\
            </div>';
        $(filterForm).appendTo(schedule.$container);

        var expand = $('<a id="show-descriptions" data-action="show" href="#"><i class="fa fa-plus-circle"></i> Show descriptions</a>').appendTo(schedule.$container);
        
        var filteredList = $('#schedule');
        $('#list-filter').change(function() {
            var filterVal = $(this).val();
            if (filterVal) {
                var filteredSessions = _.filter(schedule.sessionList, function(v, k) {
                    return (v.title.toUpperCase().indexOf(filterVal.toUpperCase()) >= 0)
                           || (v.leader.toUpperCase().indexOf(filterVal.toUpperCase()) >= 0)
                           || (v.description.toUpperCase().indexOf(filterVal.toUpperCase()) >= 0);
                });
                var filteredIDs = _.pluck(filteredSessions, 'id');
                
                $('.session-list-item').hide()
                $('.session-description').hide();
                _.each(filteredIDs, function(i) {
                    $('#session-'+i).show().find('.session-description').show();
                })
                expand.hide();
            } else {
                // nothing in filter form, so make sure everything is visible
                $('.session-description').hide();
                filteredList.find('.session-list-item').css('display','block');
                expand.show();
            }
        
            // show 'no results' message if we've removed all the items
            if ($('.session-list-item:visible').length == 0) {
                $('#no-results').remove();
                $('#filter-form').after('<p id="no-results">No matching results found.</p>');
            } else {
                $('#no-results').remove();
            }
            return false;
        }).keyup(function() {
            $(this).change();
        });
    }
    
    schedule.showFavorites = function() {
        schedule.$container.hide().empty().append('<p class="overline">Star sessions to store a list on this device</p>').append(schedule.sessionListTemplate);
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
            e.preventDefault();
            var clicked = $(this).data('session');

            schedule.trackEvent('Session Detail Opened', clicked);
            schedule.updateHash('session-'+clicked);
            schedule.getSessionDetail(clicked);
        });

        // return to full schedule from session detail view
        schedule.$container.on('click', '#show-full-schedule', function(e) {
            e.preventDefault();
            
            if (window.history.ready && !schedule.offlineMode) {
                window.history.back();
            } else {
                schedule.updateHash('');
                schedule.clearSessionDetail();
                schedule.makeSchedule();
            }
        });
        
        // toggle session descriptions
        schedule.$container.on('click', '#show-descriptions', function(e) {
            e.preventDefault();
            var clicked = $(this);
            var action = clicked.data('action');
            
            if (action == 'show') {
                $('.session-list-item').find('.session-description').show();
                clicked.html('<i class="fa fa-minus-circle"></i> Hide descriptions').data('action', 'hide');
            } else {
                $('.session-list-item').find('.session-description').hide();
                clicked.html('<i class="fa fa-plus-circle"></i> Show descriptions').data('action', 'show');
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
                schedule.trackEvent('Session Faved', sessionID);
            } else {
                schedule.savedSessionIDs = _.without(schedule.savedSessionIDs, sessionID);
                schedule.trackEvent('Session Unfaved', sessionID);
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
            schedule.trackEvent('Tab change', schedule.chosenTab);
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
    
    schedule.trackEvent = function(action, label) {
        ga('send', 'event', 'Schedule App', action, label);
    }

    // Text formatting
    schedule.smartypants = function(str) {
        return str
            // em dashes
            .replace(/--/g, '\u2014')
            // opening single quotes
            .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
            // closing single quotes & apostrophes
            .replace(/'/g, '\u2019')
            // opening double quotes
            .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
            // closing double quotes
            .replace(/"/g, '\u201d')
            // ellipses
            .replace(/\.{3}/g, '\u2026');
    }

    // Underscore templates
    schedule.sessionListTemplate = _.template(
        $("script#session-list-template").html()
    );

    schedule.sessionCardTemplate = _.template(
        $("script#session-card-template").html()
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

marked.setOptions({
    tables: false,
    smartypants: true
});

new Schedule();