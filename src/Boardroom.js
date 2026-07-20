var $ = require("jquery"),
    pushercolor = require("pusher.color"),
    moment = require("moment"),
    LightTable = require("./LightTable.js"),
    EncomGlobe = require("encom-globe"),
    SimpleClock = require("./SimpleClock.js"),
    Box = require("./Box.js"),
    SatBar = require("./SatBar.js"),
    TimerTrees = require("./TimerTrees.js"),
    StockChart = require("./StockChart.js"),
    StockChartSmall = require("./StockChartSmall.js"),
    Swirls = require("./Swirls.js"),
    Logo = require("./Logo.js");

moment.tz = require("moment-timezone");

var boardroomActive = false, 
    globe, 
    satbar, 
    simpleclock, 
    startDate, 
    box, 
    swirls, 
    sliderHeads, 
    slider, 
    lastTime, 
    screensaver, 
    locationAreas, 
    locationAreaColors = [], 
    interactionContainer,
    logo,
    blinkies,
    blinkiesColors = ["#000", "#ffcc00", "#00eeee", "#fff"],
    picIndex = 0,
    currentPics = [],
    lastPicDate = Date.now(),
    streamType,
    blogMode,
    readmeContainer;

sliderHeads = {};
var Boardroom = {};

function createBlogHistory(posts) {
    var countsByDate = {};
    posts.forEach(function(post){
        var date = post.date || "unknown";
        countsByDate[date] = (countsByDate[date] || 0) + 1;
    });

    return Object.keys(countsByDate).sort().map(function(date, index){
        return {
            year: parseInt(date.slice(0, 4), 10) || 2014,
            month: parseInt(date.slice(5, 7), 10) || 1,
            day: parseInt(date.slice(8, 10), 10) || index + 1,
            events: countsByDate[date]
        };
    });
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function(char){
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char];
    });
}

function createDiscoveryButton(label, className, handler, current) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className || "blog-discovery-control";
    button.textContent = String(label == null ? "" : label);
    button.setAttribute("aria-label", String(label == null ? "" : label));
    if (current) button.setAttribute("aria-current", "true");
    button.addEventListener("click", handler);
    return button;
}

function appendDiscoveryGroup(parent, label, items, handler, currentValue) {
    if (!items.length) return;
    var group = document.createElement("div");
    group.className = "blog-discovery-group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    var heading = document.createElement("span");
    heading.className = "blog-discovery-label";
    heading.textContent = label;
    group.appendChild(heading);
    items.forEach(function (item) {
        var value = String(item);
        group.appendChild(createDiscoveryButton(value, "blog-discovery-option", function () {
            handler(value);
        }, currentValue != null && String(currentValue) === value));
    });
    parent.appendChild(group);
}

function renderBlogDiscovery(parent, controller) {
    var index = controller && controller.getIndex ? controller.getIndex() : (window.BLOG_INDEX || {});
    var currentLens = controller && controller.getLens ? controller.getLens() : blogMode;
    var discovery = document.createElement("section");
    discovery.className = "blog-discovery";
    discovery.setAttribute("aria-label", "Archive discovery controls");

    var heading = document.createElement("h4");
    heading.textContent = "DISCOVERY";
    discovery.appendChild(heading);

    var lenses = document.createElement("div");
    lenses.className = "blog-discovery-lenses";
    lenses.setAttribute("role", "group");
    lenses.setAttribute("aria-label", "Archive lenses");
    [
        ["Featured", "featured"],
        ["Latest", "latest"],
        ["Topics", "topics"],
        ["Archive", "archive"],
        ["Search", "search"]
    ].forEach(function (entry) {
        lenses.appendChild(createDiscoveryButton(entry[0], "blog-discovery-lens", function () {
            if (controller && controller.setLens) controller.setLens(entry[1]);
        }, currentLens === entry[1]));
    });
    discovery.appendChild(lenses);

    var tagNames = index && index.tags ? Object.keys(index.tags) : [];
    appendDiscoveryGroup(discovery, "Topics / tags", tagNames, function (tag) {
        if (controller && controller.setFilterTag) controller.setFilterTag(tag);
    }, controller && controller.state ? controller.state.filterTag : null);

    var yearNames = index && index.archiveByYear ? Object.keys(index.archiveByYear).sort().reverse() : [];
    appendDiscoveryGroup(discovery, "Archive / years", yearNames, function (year) {
        if (controller && controller.setFilterYear) controller.setFilterYear(year);
    }, controller && controller.state ? controller.state.filterYear : null);

    var searchForm = document.createElement("form");
    searchForm.className = "blog-discovery-search";
    searchForm.setAttribute("role", "search");
    var searchLabel = document.createElement("label");
    searchLabel.textContent = "Search archive";
    var searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.name = "archive-search";
    searchInput.placeholder = "Search posts";
    searchInput.setAttribute("aria-label", "Search archive");
    if (controller && controller.state && controller.state.lens === "search") {
        searchInput.value = controller.state.searchQuery || "";
    }
    var searchButton = document.createElement("button");
    searchButton.type = "submit";
    searchButton.textContent = "Search";
    searchLabel.appendChild(searchInput);
    searchForm.appendChild(searchLabel);
    searchForm.appendChild(searchButton);
    searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (controller && controller.setSearch) controller.setSearch(searchInput.value.trim());
    });
    discovery.appendChild(searchForm);
    parent.appendChild(discovery);
}

function renderBlogInteractions() {
    if(streamType !== "blog" || !interactionContainer){
        return;
    }

    // Delegate to the unified controller when available (it owns lens
    // state). Fall back to local filtering for non-controller contexts.
    var controller = window.BlogController;
    var posts;
    if (controller && controller.getVisiblePosts) {
        posts = controller.getVisiblePosts();
    } else {
        posts = Boardroom.posts.slice();
        if(blogMode === "featured"){
            posts = posts.filter(function(post){ return post.featured; });
            if(!posts.length){
                posts = Boardroom.posts.slice(0, 1);
            }
        } else if(blogMode === "archive"){
            posts.sort(function(left, right){
                return new Date(left.date) - new Date(right.date);
            });
        }
    }

    interactionContainer.empty();
    var selectedSlug = controller && controller.getSelectedSlug ? controller.getSelectedSlug() : null;
    posts.forEach(function(post){
        var label = [post.title, post.category, post.date, post.readTime, (post.tags || []).join(", ")].filter(Boolean).join(" — ");
        var isSelected = post.slug === selectedSlug;
        var row = $('<button type="button" class="interaction-data blog-interaction" data-post-slug="' + escapeHtml(post.slug) + '" tabindex="0" aria-label="' + escapeHtml(label) + '"' + (isSelected ? ' aria-current="true"' : '') + '>' +
            '<span class="interaction-username">' + escapeHtml(post.category || "post") + '</span>' +
            '<span class="interaction-title">' + escapeHtml(post.title) + '</span>' +
            '<span class="interaction-type">' + escapeHtml((post.tags || []).join(", ")) + '</span>' +
            '<span class="interaction-size">' + escapeHtml(post.readTime || "?") + 'm</span>' +
            '<span class="interaction-popularity">' + (post.featured ? "featured" : "archive") + '</span>' +
        '</button>');

        // Handle keyboard activation (Enter/Space)
        row.on('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (controller && controller.openPost) {
                    controller.openPost(post.slug);
                }
            }
        });

        // Handle click activation
        row.on('click', function() {
            if (controller && controller.openPost) {
                controller.openPost(post.slug);
            }
        });

        interactionContainer.append(row);
    });
    renderBlogDiscovery(interactionContainer[0], controller);
}

Boardroom.renderBlogInteractions = renderBlogInteractions;

Boardroom.init = function(_streamType, data, _blogMode){

    streamType = _streamType;
    blogMode = _blogMode || "featured";
    blinkies = $('.blinky');
    mediaBoxes = $('.media-box .user-pic');

    var ratio = $(window).width() / 1918;
    $("#boardroom").css({
        "zoom": ratio,
        "-moz-transform": "scale(" + ratio + ")",
        "-moz-transform-origin": "0 0"
    });
    $("#boardroom").center(ratio);

    readmeContainer = $("#boardroom-readme-" + _streamType);

    Boardroom.posts = streamType === "blog" ? (data || []) : [];
    Boardroom.data = streamType === "blog" ? createBlogHistory(Boardroom.posts) : data;


    $("#fullscreen-link").click(function(e){
        e.preventDefault();
        var el = document.documentElement, 
            rfs = el.requestFullScreen || el.webkitRequestFullScreen || el.mozRequestFullScreen;

        rfs.call(el);

    });

    $("#info-link").click(function(e){
        e.preventDefault();
        showReadme();
    });

    $(".boardroom-readme h2 em").click(function(e){
        e.preventDefault();
        hideReadme();
    });

    setInterval(function(){
        if(boardroomActive){
            $("#san-francisco-time").text(moment().tz("America/Los_Angeles").format("HH:mm:ss"));
            $("#new-york-time").text(moment().tz("America/New_York").format("HH:mm:ss"));
            $("#london-time").text(moment().tz("Europe/London").format("HH:mm:ss"));
            $("#berlin-time").text(moment().tz("Europe/Berlin").format("HH:mm:ss"));
            $("#bangalore-time").text(moment().tz("Asia/Colombo").format("HH:mm:ss"));
            $("#sydney-time").text(moment().tz("Australia/Sydney").format("HH:mm:ss"));
        }
    }, 1000);

    locationAreas = {
        antarctica: {count: 10, ref: $("#location-area-antarctica")},
        northamerica: {count: 10, ref: $("#location-area-northamerica")},
        southamerica: {count: 10, ref: $("#location-area-southamerica")},
        europe: {count: 10, ref: $("#location-area-europe")},
        asia: {count: 10, ref: $("#location-area-asia")},
        australia: {count: 10, ref: $("#location-area-australia")},
        africa: {count: 10, ref: $("#location-area-africa")},
        other: {count: 10, ref: $("#location-area-other")},
        unknown: {count: 10, ref: $("#location-area-unknown")}
    };

    if(streamType === "blog"){
        $("#user-interaction-header").text("ARCHIVE REPLAY");
        $("#globalization-header").text("ARCHIVE GEOGRAPHY");
        $("#growth-header").text("ARCHIVE GROWTH");
        $("#media-header").text("POST MEDIA");
        $("#timer-header").text("TIME SINCE ARCHIVE BOOT");
        // Remove upstream placeholder copy from active blog panels.
        $("#media-top-info").html("<span>hero images</span><span>attachments</span><span>related artwork</span>");
        $("#media-bottom-info").html("<span>archive media</span><span>referenced assets</span>");
        $("#media-top-blinkies h3:first").text("TAG FREQUENCY");
        $("#media-bottom-blinkies h3:first").text("BACKLINK DENSITY");
        $("#interaction h3").text("ARCHIVE RESULTS");
    } else {
        $("#user-interaction-header").text(streamType.toUpperCase() + " LIVE DATA FEED");
        $("#globalization-header").text(streamType.toUpperCase() + " GLOBALIZATION");
        $("#growth-header").text(streamType.toUpperCase() + " HISTORIC PERFORMANCE");
        $("#media-header").text(streamType.toUpperCase() + " USERS");
    }

    $("#ticker-text").text(streamType.toUpperCase());
    if(streamType.length > 6){
        $("#ticker-text").css("font-size", "12pt");
    }

    if(streamType === "blog"){
        $("#ticker-value").text(Boardroom.posts.length);
        $("#ticker-ytd").text("Posts");
    } else if(data){
        $("#ticker-value").text(formatYTD(data[0].events, data[data.length-1].events));
    }

    setInterval(function(){
        if(boardroomActive){
            for(var a in locationAreas){
                var loc = locationAreas[a];
                loc.count = loc.count -1;
                loc.count = Math.max(loc.count, 0);

                loc.ref.css("background-color", locationAreaColors[loc.count]);

            }
        }
    }, 3000);

    interactionContainer = $("#interaction > div");

    for(var i = 0; i< 50; i++){
        interactionContainer.append('<ul class="interaction-data"></ul>');
    }

    renderBlogInteractions();
};

Boardroom.show = function(cb){
    startDate = new Date();
    lastTime = Date.now();

    $("#boardroom").css({"visibility": "visible"});
    for(var i = 0; i< 20; i++){
        locationAreaColors[i] = pushercolor('#00eeee').blend('#ffcc00', i/20).hex6();
    }

    //animate();

    // render the other elements intro animations

    $(".footer-bar").delay(1000).animate({"margin-top": "0"}, 500);

    $("#globe-footer img").delay(1500).animate({"opacity": "1"}, 1000);

    $("#globalization").delay(600).animate({
        top: "0px",
        left: "0px",
        width: "180px"
    }, 500);

    $("#globalization .location-slider").each(function(index, element){
        $(element).delay(600 + index * 200).animate({
            width: "180px"
        }, 1000);
    });

    $("#logo-cover-up").delay(3000).animate({
        height: "0px"
    }, 2500);

    $("#logo-cover-side-1").delay(3000).animate({
        left: "200px"
    }, 2500);

    $("#logo-cover-side-2").delay(3000).animate({
        width: "0px"
    }, 2500);

    $("#user-interaction").delay(500).animate({
        width: "600px"
    }, 1500);

    $("#growth").delay(1000).animate({
        width: "600px"
    }, 1500);

    $("#media").delay(1500).animate({
        width: "450px"
    }, 1500);

    $("#timer").delay(2000).animate({
        width: "450px"
    }, 1500);

    $("#bottom-border").delay(100).animate({
        width: "1900px"
    }, 2000);

    setTimeout(function(){
        for(var i = 0; i< 2; i++){
            for(var j = 0; j< 3; j++){
                globe.addSatellite(50 * i - 30 + 15 * Math.random(), 120 * j - 120 + 30 * i, 1.3 + Math.random()/10);
            }
        }
    }, 5000);

    setInterval(function(){
        satbar.setZone(Math.floor(Math.random()*4-1));
    }, 7000);

    setTimeout(function(){
        globe.addMarker(49.25, -123.1, "Vancouver");
        globe.addMarker(35.68, 129.69, "Tokyo", true);
    }, 2000);

    globe = new EncomGlobe(600, 600, {
        tiles: grid.tiles,
        pinColor: "#8FD8D8",
        viewAngle: .1
    });
    $("#globe").append(globe.domElement);


    simpleclock = new SimpleClock("simpleclock");

    globe.init(function(){
        // called after the globe is complete

        // give anything else on the other side a second before starting
        setTimeout(function(){
            box = new Box({containerId: "cube"});
            satbar = new SatBar("satbar");
            timertrees = new TimerTrees("timer-trees");
            stockchart = new StockChart("stock-chart", {data: Boardroom.data});
            stockchartsmall = new StockChartSmall("stock-chart-small", {data: Boardroom.data});
            swirls = new Swirls("swirls");
            logo = new Logo("logo", streamType.toUpperCase());
            boardroomActive = true;
        }, 1000);

        if(typeof cb === "function"){
            cb();
        }
    });

};

Boardroom.hide = function(){
    boardroomActive = false;

    box = null;
    satbar = null;
    timertrees =null;
    stockchart = null;
    stockchartsmall = null;
    swirls = null;
    logo = null;

};

Boardroom.animate = function(){
    if(boardroomActive){
        var animateTime = Date.now() - lastTime;
        lastTime = Date.now();

        globe.tick();
        satbar.tick();
        $("#clock").text(getTime());
        simpleclock.tick();
        box.tick();
        stockchart.tick();
        swirls.tick();
        updateSliders(animateTime);
    }
};

Boardroom.resetAnimationClock = function(){
    lastTime = Date.now();
};
Boardroom.message = function(message){

    if(message.stream != streamType || !globe){
        return;
    }

    if(message.latlon){
        var latlon = message.latlon;
        globe.addPin(latlon.lat, latlon.lon, message.location);
    }
    
    if(message.picSmall || message.picLarge){
        addPic(message);
    }

    if(message.type && swirls){
        swirls.hit(message.type);
    }
    
    if(interactionContainer && interactionContainer[0].lastChild){
        var interactionNode = interactionContainer[0];
        var lastChild = interactionNode.lastChild;
        if (streamType === "blog") {
            for (var childIndex = interactionNode.children.length - 1; childIndex >= 0; childIndex--) {
                var candidate = interactionNode.children[childIndex];
                if (candidate.classList && candidate.classList.contains("blog-interaction")) {
                    lastChild = candidate;
                    break;
                }
            }
        }
        if (!lastChild || (streamType === "blog" && !lastChild.classList.contains("blog-interaction"))) {
            return;
        }
        var slugAttr = message.slug ? ' data-post-slug="' + escapeHtml(message.slug) + '"' : '';
        var ariaCurrentAttr = (message.slug && window.BlogController && window.BlogController.getSelectedSlug() === message.slug) ? ' aria-current="true"' : '';
        var label = [message.title, message.category, message.date, message.readTime, (message.tags || []).join(", ")].filter(Boolean).join(" — ");
        
        // For blog streams, replace placeholder <ul> with semantic <button>
        if (streamType === "blog") {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'interaction-data blog-interaction';
            button.innerHTML = 
              '<span class="interaction-username">' + escapeHtml(message.username || message.category || "post") + '</span>' +
              '<span class="interaction-title">' + escapeHtml(message.title) + '</span>' +
              '<span class="interaction-type">' + escapeHtml((message.tags || []).join(", ")) + '</span>' +
              '<span class="interaction-size">' + escapeHtml(message.readTime || "?") + 'm</span>' +
              '<span class="interaction-popularity">' + (message.featured ? "featured" : "archive") + '</span>';
            
            if (slugAttr) button.setAttribute('data-post-slug', message.slug);
            if (ariaCurrentAttr) button.setAttribute('aria-current', 'true');
            button.setAttribute('aria-label', label);
            button.setAttribute('tabindex', '0');
            
            if(message.popularity > 100){
              button.innerHTML = '<span class="interaction-popular">!</span>' + button.innerHTML;
            }
            
            interactionContainer[0].replaceChild(button, lastChild);
            lastChild = button;
        } else {
            // Non-blog streams: preserve original placeholder/list behavior
            lastChild.innerHTML = 
              '<span class="interaction-username">' + escapeHtml(message.username || message.category || "post") + '</span>' +
              '<span class="interaction-title">' + escapeHtml(message.title) + '</span>' +
              '<span class="interaction-type">' + escapeHtml((message.tags || []).join(", ")) + '</span>' +
              '<span class="interaction-size">' + escapeHtml(message.readTime || "?") + 'm</span>' +
              '<span class="interaction-popularity">' + (message.popularity > 100 ? "featured" : "archive") + '</span>';
            
            if (slugAttr) lastChild.setAttribute('data-post-slug', message.slug);
            if (ariaCurrentAttr) lastChild.setAttribute('aria-current', 'true');
            else lastChild.removeAttribute('aria-current');
            lastChild.setAttribute('aria-label', label);
            lastChild.setAttribute('tabindex', '0');
            lastChild.setAttribute('role', 'button');

            if(message.popularity > 100){
              lastChild.innerHTML = '<span class="interaction-popular">!</span>' + lastChild.innerHTML;
            }
        }
        
        var firstChild = interactionNode.firstChild;
        if (streamType === "blog") {
            for (var firstIndex = 0; firstIndex < interactionNode.children.length; firstIndex++) {
                var firstCandidate = interactionNode.children[firstIndex];
                if (firstCandidate.classList && firstCandidate.classList.contains("blog-interaction")) {
                    firstChild = firstCandidate;
                    break;
                }
            }
        }
        if (firstChild && lastChild !== firstChild) {
            interactionNode.insertBefore(lastChild, firstChild);
        }
    }

    createZipdot(message);


};

Boardroom.resize = function(){
    var ratio = $(window).width() / 1918;
    $("#boardroom").css({
        "zoom": ratio,
        "-moz-transform": "scale(" + ratio + ")",
        "-moz-transform-origin": "0 0"
    });

    $("#boardroom").center(ratio);
};

function showReadme() {

    var itemContent = readmeContainer.find(".content");

    readmeContainer.removeAttr("style");

    var height = readmeContainer.height();
    var width = readmeContainer.width();
    var left = ($(window).width() - 500)/ 2;
    var top = ($(window).height() - 500) / 2;

    var border = readmeContainer.css("border");
    var boxShadow = readmeContainer.css("box-shadow");

    var contentBorder = itemContent.css("border");
    var contentBoxShadow = itemContent.css("box-shadow");

    itemContent.children().each(function(index, element){
        $(element).css("visibility", "hidden");
    });

    readmeContainer.height(0)
    .width(0)
    .css("top", top + height/2)
    .css("left", left + width/2)
    .css("visibility", "visible");


    readmeContainer.animate({
        height: height,
        width: "500px",
        left: left,
        top: top

    }, 500);
    readmeContainer.css({
        opacity: 1
    });

    setTimeout(function(){

        itemContent.children().each(function(index, element){
            $(element).css("visibility", "visible");
        });


    }, 1000);

}

function hideReadme(){
    readmeContainer.css("visibility", "hidden");
    readmeContainer.children().each(function(index, element){
        $(element).removeAttr("style");
        $(element).children().each(function(index, element){
            $(element).removeAttr("style");
        });
    });
}

function createZipdot(message){

    var area = "unknown";

    if(message.latlon){
        area = findArea(message.latlon.lat, message.latlon.lon);
        $("#location-city-" + area).text(message.location);
    }

    locationAreas[area].count = locationAreas[area].count + 1;
    locationAreas[area].count = Math.min(19,locationAreas[area].count);
    locationAreas[area].ref.css("background-color", locationAreaColors[locationAreas[area].count]);

    $("#location-slider-" + area + " ul :first-child").css("margin-left", "-=5px");
    $("#location-slider-" + area + " ul").prepend("<li style='color: " + locationAreaColors[locationAreas[area].count] + "'></li>");
    sliderHeads[area] = {area: area, element: $("#location-slider-" + area + " ul :first-child"), margin: 0}; 

};

function changeBlinkies(){
    $(blinkies[Math.floor(Math.random() * blinkies.length)]).css('background-color', blinkiesColors[Math.floor(Math.random() * blinkiesColors.length)]);
}

function addPic(data){
    var pic = data.picSmall;
    var showPic = true;

    if(currentPics.length < 10 || Date.now() - lastPicDate > 2000){

        if($(mediaBoxes[picIndex]).width() > 100){
            pic = data.picLarge;
        }

        for(var i = 0; i< currentPics.length && showPic; i++){
            if(pic.indexOf("http") === 0 && (currentPics[i] == data.picSmall || currentPics[i] == data.picLarge)){
                showPic = false;
            }
        }

        if(showPic){



            var profileImageLoaded = function(ui){
                var mb = $(mediaBoxes[ui]);
                mb.css('background-image', 'url(' + pic + ')');
                mb.find('span').text(data.username);
                mb.off();
                mb.click(function(){window.open(data.userurl, "_blank")});
            };

            if(pic.indexOf("http") === 0){
                var img = document.createElement('img');
                img.addEventListener('load', profileImageLoaded.bind(this, picIndex));
                img.src = pic;
            } else {
                profileImageLoaded(picIndex);
            }

            currentPics[picIndex] = pic;

            picIndex++;
            picIndex = picIndex % 10;

            lastPicDate = Date.now();

        }
    }
}


function updateSliders(animateTime){

    var incDistance = Math.floor(200 * animateTime / 1000);

    var rem = [];
    for(var s in sliderHeads){
        var slider = sliderHeads[s];
        slider.margin += incDistance;
        if(slider.margin > 200){
            rem.push(slider);
        } else {
            slider.element.css("margin-left", slider.margin + "px"); 
        }
    }

    for(var i = 0; i< rem.length; i++){
        delete sliderHeads[rem[i].area];
        rem[i].element.siblings().remove();
    }

    if(Math.random()<.1){
        $(".location-slider ul").each(function(index, val){
                var ch = $(val).children();
                if(ch.length > 10){
                ch.slice(10-ch.length).remove();
                }
                });
    }
}

function findArea(lat, lng){
    if(lat <= -40){
        return "antarctica";
    }
    if(lat > 12 && lng > -180 && lng < -45){
        return "northamerica";
    }
    if(lat <= 12 && lat > -40 && lng > -90 && lng < -30){
        return "southamerica";
    }
    if(lat < -10 && lng >= 105 && lng <=155){
        return "australia";
    }
    if(lat > 20 && lng >= 60 && lng <=160){
        return "asia";
    }
    if(lat > 10 && lat < 40 && lng >= 35 && lng <=60){
        return "asia";
    }
    if(lat > -40 && lat < 35 && lng >= -20 && lng <=50){
        return "africa";
    }
    if(lat >= 35 && lng >= -10 && lng <=40){
        return "europe";
    }

    return "other";
}


function getTime(){

    var elapsed = new Date() - startDate;

    var mili = Math.floor((elapsed/10) % 100);
    var seconds = Math.floor((elapsed / 1000) % 60); 
    var minutes = Math.floor((elapsed / 60000) % 100); 
    var hours = Math.floor((elapsed / 3600000) % 100); 

    return (hours < 10 ? "0":"") + hours + ":" + (minutes < 10 ? "0":"") + minutes + ":" + (seconds< 10? "0": "") + seconds + ":" + (mili < 10? "0" : "") + mili;

}

function formatYTD(first, last){
    var percentage = 100 * (((last- first) / first) - 1);
    var output = percentage.toFixed(1) + "%";
    if(percentage > 0 && percentage < 100){
        output = "+" + output;
    }

    return output;
};

module.exports =  Boardroom;

