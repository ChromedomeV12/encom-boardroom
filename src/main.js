var $ = require("jquery"),
    EventSource = require("event-source"),
    Boardroom = require("./Boardroom.js"),
    BlogController = require("./BlogController.js"),
    MotionController = require("./MotionController.js"),
    PleaseRotate = require("pleaserotate.js"),
    init = false;

require("jquery-ui");
// Expose the blog controller on the window so the non-bundled adapter
// (js/blog-adapter.js, loaded as a separate <script>) can consume it
// without a require() call. Init it with the generated post data.
window.BlogController = BlogController;
window.Boardroom = Boardroom;
if (window.BLOG_POSTS) {
    BlogController.init(window.BLOG_POSTS, window.BLOG_INDEX || {});
}

$.fn.center = function (scale) {

    var top = Math.max(0, (($(window).height() - $(this).outerHeight()) / 2 - 50) + $(window).scrollTop());
    var left = Math.max(0, (($(window).width() - $(this).outerWidth()) / 2) + $(window).scrollLeft());

    if(scale){
        top = Math.max(0, (($(window).height() - $(this).outerHeight() * scale) / 2 - 50) + $(window).scrollTop());
        left = Math.max(0, (($(window).width() - $(this).outerWidth() * scale) / 2) + $(window).scrollLeft());
    }

    this.css("position","fixed");
    this.css("top", top + "px");
    this.css("left", left + "px");
    return this;
}

var active = "lt";
var esPath = "/events.js";
if(window._esPath){
    esPath = window._esPath;
}
var listener = function (event) {
    var div = document.createElement("div");
    var type = event.type;
    if(type === "message"){
        if(active === "lt"){
            LightTable.message(JSON.parse(event.data));
        } else {
            setTimeout(function(){
                Boardroom.message(JSON.parse(event.data));
            }, 3000 * Math.random());
        }
    }
};
if(!window.BLOG_POSTS){
    var es = new EventSource(esPath);
    es.addEventListener("open", listener);
    es.addEventListener("message", listener);
    es.addEventListener("error", listener);
}


var onSwitch = function(view){
    var screensaver = $("#screensaver");
    screensaver.center();
    screensaver.css({visibility: "visible"});

    screensaver.delay(3000).animate({ opacity: 0 },{ 
        step: function(now, tween){ 
            screensaver.css('transform', 'scale(' + now + ',' + now + '');
        },
        duration: 600, 
        easing: "easeInOutBack"});

    if(view === "blog"){

        screensaver.text("BLOG");
        LightTable.hide();
        Boardroom.init("blog", window.BLOG_POSTS || [], window.BLOG_LAUNCH_MODE || "featured");

        setTimeout(function(){
            active = "br";
            Boardroom.show(function(){
                // Explicit lifecycle event: the boardroom is ready.
                // Replaces the adapter's retry-timer boot cascade.
                BlogController.onBoardroomReady();
            });
        }, 3000)

    } else if(view === "github"){

        screensaver.text("GITHUB");
        LightTable.hide();
        Boardroom.init("github", window.githubHistory);

        setTimeout(function(){
            active = "br";
            Boardroom.show();
        }, 3000)

    } else if (view === "wikipedia"){
        $("#screensaver").text("WIKIPEDIA");
        LightTable.hide();
        Boardroom.init("wikipedia");
        setTimeout(function(){
            active = "br";
            Boardroom.show();
        }, 3000)

    } else if (view === "test"){
        $("#screensaver").text("TEST DATA");
        LightTable.hide();
        Boardroom.init("test");
        setTimeout(function(){
            active = "br";
            Boardroom.show();
        }, 3000)

        /* lets just throw some data in there */

        setInterval(function(){
            if(Boardroom){
                Boardroom.message({
                    stream: 'test',
                    latlon: {
                        lat: Math.random() * 180 - 90,
                        lon: Math.random() * 360 - 180
                    },
                    location: 'Test ' + Math.floor(Math.random() * 100),
                    type: 'Type ' + Math.floor(Math.random() * 8),
                    picSmall: 'images/not_available_small.png',
                    picLarge: 'images/not_available_large.png',
                    username: "arscan" + Math.floor(Math.random()*1000),
                    userurl: "http://github.com/arscan",
                    title: "Test " + Math.floor(Math.random() * 100),
                    url: "http://github.com/arscan/encom-boardroom/",
                    size: Math.floor(Math.random()*10000),
                    popularity: Math.floor(Math.random()*10000)
                });
            }

        }, 800);
    }

};

PleaseRotate.start({onHide: function(){
    if(init){
        return;
    }
    init = true;
    try {
        LightTable.init(onSwitch);

    } catch (ex){

        
        $("#error-message")
           .css("visibility","visible")
           .center();

        console.log(ex);

        return;


    }
    $("#light-table").center();
    $("#boardroom").center();
    LightTable.show();

    // Create motion policy with browser dependencies
    var motionPolicy = MotionController.create({
        document: window.document,
        matchMedia: window.matchMedia.bind(window),
        IntersectionObserver: window.IntersectionObserver,
        localStorage: window.localStorage,
        boardroomElement: document.getElementById('boardroom'),
        onResume: Boardroom.resetAnimationClock
    });
    
    // Connect BlogController reader signals to motion policy
    BlogController.on('reader-open', function() {
        motionPolicy.setReaderOpen(true);
    });
    BlogController.on('reader-close', function() {
        motionPolicy.setReaderOpen(false);
    });

    var animate = function(){

        if(active === "lt" && motionPolicy.shouldTick('lighttable')) {
            LightTable.animate();
        } else if (active === "br" && motionPolicy.shouldTick('boardroom')) {
            Boardroom.animate()
        }

        requestAnimationFrame(animate);
    };

    animate();

    var timeout = 0;
    function onWindowResize(){

        if(active === "lt"){
            LightTable.resize();
        } else {
            Boardroom.resize();
        }
    }

    window.addEventListener( 'resize', onWindowResize, false );
    
    // Wire policy cleanup on page lifecycle
    window.addEventListener('pagehide', function() {
        motionPolicy.cleanup();
    });

}});
