'use strict';
/*!
 * PacPepe v1.0.0
*/



// requestAnimationFrame polyfill
if (!Date.now)
Date.now = function() { return new Date().getTime(); };
(function() {
    'use strict';
    var vendors = ['webkit', 'moz'];
    for (var i = 0; i < vendors.length && !window.requestAnimationFrame; ++i) {
        var vp = vendors[i];
        window.requestAnimationFrame = window[vp+'RequestAnimationFrame'];
        window.cancelAnimationFrame = (window[vp+'CancelAnimationFrame'] || window[vp+'CancelRequestAnimationFrame']);
    }
    if (/iP(ad|hone|od).*OS 6/.test(window.navigator.userAgent) // iOS6 is buggy
    || !window.requestAnimationFrame || !window.cancelAnimationFrame) {
        var lastTime = 0;
        window.requestAnimationFrame = function(callback) {
            var now = Date.now();
            var nextTime = Math.max(lastTime + 16, now);
            return setTimeout(function() { callback(lastTime = nextTime); },
            nextTime - now);
        };
        window.cancelAnimationFrame = clearTimeout;
    }
}());

function Game(id,params){
    var _ = this;
    var settings = {
        width:960,						
        height:640						
    };
    Object.assign(_,settings,params);
    var $canvas = document.getElementById(id);
    $canvas.width = _.width;
    $canvas.height = _.height;
    var _context = $canvas.getContext('2d');	
    var _stages = [];							
    var _events = {};							
    var _index=0,								
        _hander;  								
    // Item constructor
    var Item = function(params){
        this._params = params||{};
        this._id = 0;               // Marker
        this._stage = null;         // Bind with the stage
        this._settings = {
            x:0,					// Position coordinates: abscissa
            y:0,					// Position coordinates: ordinate
            width:20,				// Width
            height:20,				// Height
            type:0,					// Object type, 0 means normal object (not bound to the map), 1 means player-controlled object, 2 indicates program-controlled object
            color:'#F00',			// Object color
            status:1,				//Object status, 0 means not activated/ended, 1 means normal, 2 means paused, 3 means temporary, and 4 means abnormal
            orientation:0,			// In the current positioning direction, 0 means right, 1 means down, 2 means left, and 3 means up
            speed:0,				// Speed, 0 means no movement
            // Map related
            location:null,			// Location object
            coord:null,				//If the object is bound to a map, you need to set the map coordinates; If not bound, the location coordinates are set
            path:[],				// NPC path
            vector:null,			// NPC direction vector
            // Animation related
            frames:1,				// Speed level, internal counter times how many frames change once
            times:0,				// Refresh canvas counter (used for loop animation status judgment)
            timeout:0,				// Countdown
            control:{},				// Control object
            update:function(){}, 	// Update parameter information
            draw:function(){}		// Draw object
        };
        Object.assign(this,this._settings,this._params);
    };
    Item.prototype.bind = function(eventType,callback){
        if(!_events[eventType]){
            _events[eventType] = {};
            $canvas.addEventListener(eventType,function(e){
                var position = _.getPosition(e);
                _stages[_index].items.forEach(function(item){
                    if(item.x<=position.x&&position.x<=item.x+item.width&&item.y<=position.y&&position.y<=item.y+item.height){
                        var key = 's'+_index+'i'+item._id;
                        if(_events[eventType][key]){
                            _events[eventType][key](e);
                        }
                    }
                });
                e.preventDefault();
            });
        }
        _events[eventType]['s'+this._stage.index+'i'+this._id] = callback.bind(this);  // Bind scope
    };
    // Map constructor
    var Map = function(params){
        this._params = params||{};
        this._id = 0;               // Marker
        this._stage = null;         // Bind with the stage
        this._settings = {
            x:0,					// Position coordinates: abscissa
            y:0,                    // Position coordinates: ordinate
            size:20,				// Size
            data:[],				// Map data
            x_length:0,				// Two-dimensional array x-axis length
            y_length:0,				// Two-dimensional array y-axis length
            frames:1,				// Speed level, internal counter times how many frames change once
            times:0,				// Refresh canvas counter (used for loop animation status judgment)
            cache:false,    		// Whether to cache the map
            update:function(){},	// Update parameter information
            draw:function(){},		// Draw object
        };
        Object.assign(this,this._settings,this._params);
    };
    // Update map
    Map.prototype.get = function(x,y){
        if(this.data[y]&&typeof this.data[y][x]!='undefined'){
            return this.data[y][x];
        }
        return -1;
    };
    // Set map
    Map.prototype.set = function(x,y,value){
        if(this.data[y]){
            this.data[y][x] = value;
        }
    };
    // Canvas coordinates to map coordinates
    Map.prototype.coord2position = function(cx,cy){
        return {
            x:this.x+cx*this.size+this.size/2,
            y:this.y+cy*this.size+this.size/2
        };
    };
    //  Map coordinates to canvas coordinates
    Map.prototype.position2coord = function(x,y){
        var fx = Math.abs(x-this.x)%this.size-this.size/2;
        var fy = Math.abs(y-this.y)%this.size-this.size/2;
        return {
            x:Math.floor((x-this.x)/this.size),
            y:Math.floor((y-this.y)/this.size),
            offset:Math.sqrt(fx*fx+fy*fy)
        };
    };
    // Path way
    Map.prototype.finder = function(params){
        var defaults = {
            map:null,
            start:{},
            end:{},
            type:'path'
        };
        var options = Object.assign({},defaults,params);
        if(options.map[options.start.y][options.start.x]||options.map[options.end.y][options.end.x]){ // Wall start or end
            return [];
        }
        var finded = false;
        var result = [];
        var y_length  = options.map.length;
        var x_length = options.map[0].length;
        var steps = Array(y_length).fill(0).map(()=>Array(x_length).fill(0));     // Steps mapping
        var _getValue = function(x,y){  // Map values
            if(options.map[y]&&typeof options.map[y][x]!='undefined'){
                return options.map[y][x];
            }
            return -1;
        };
        var _next = function(to){ // Determine whether the next step is available
            var value = _getValue(to.x,to.y);
            if(value<1){
                if(value==-1){
                    to.x = (to.x+x_length)%x_length;
                    to.y = (to.y+y_length)%y_length;
                    to.change = 1;
                }
                if(!steps[to.y][to.x]){
                    result.push(to);
                }
            }
        };
        var _render = function(list){// Path finder
            var new_list = [];
            var next = function(from,to){
                var value = _getValue(to.x,to.y);
                if(value<1){	// Possible path or end
                    if(value==-1){
                        to.x = (to.x+x_length)%x_length;
                        to.y = (to.y+y_length)%y_length;
                        to.change = 1;
                    }
                    if(to.x==options.end.x&&to.y==options.end.y){
                        steps[to.y][to.x] = from;
                        finded = true;
                    }else if(!steps[to.y][to.x]){
                        steps[to.y][to.x] = from;
                        new_list.push(to);
                    }
                }
            };
            list.forEach(function(current){
				next(current,{y:current.y+1,x:current.x});
                next(current,{y:current.y,x:current.x+1});
                next(current,{y:current.y-1,x:current.x});
                next(current,{y:current.y,x:current.x-1});
            });
            if(!finded&&new_list.length){
                _render(new_list);
            }
        };
        _render([options.start]);
        if(finded){
            var current=options.end;
            if(options.type=='path'){
                while(current.x!=options.start.x||current.y!=options.start.y){
                    result.unshift(current);
                    current=steps[current.y][current.x];
                }
            }else if(options.type=='next'){
                _next({x:current.x+1,y:current.y});
                _next({x:current.x,y:current.y+1});
                _next({x:current.x-1,y:current.y});
                _next({x:current.x,y:current.y-1});
            }
        }
        return result;
    };
    // Stage constructor
    var Stage = function(params){
        this._params = params||{};
        this._settings = {
            index:0,                        // Stage Index
            status:0,						// 0=not active, 1=active, 2=pause, 3=temporary
            maps:[],						// map queue
            audio:[],						// audio queue
            images:[],						// image queue
            items:[],						// item queue
            timeout:0,						// Countdown
            update:function(){}				
        };
        Object.assign(this,this._settings,this._params);
    };
    // Add item
    Stage.prototype.createItem = function(options){
        var item = new Item(options);
        // Object Dynamic properties
        if(item.location){
            Object.assign(item,item.location.coord2position(item.coord.x,item.coord.y));
        }
        // object relationship
        item._stage = this;
        item._id = this.items.length;
        this.items.push(item);
        return item;
    };
    // Reset item
    Stage.prototype.resetItems = function(){
        this.status = 1;
        this.items.forEach(function(item,index){
            Object.assign(item,item._settings,item._params);
            if(item.location){
                Object.assign(item,item.location.coord2position(item.coord.x,item.coord.y));
            }
        });
    };
    // Get items by type
    Stage.prototype.getItemsByType = function(type){
        return this.items.filter(function(item){
	    return item.type == type;
        });
    };
    // Add map
    Stage.prototype.createMap = function(options){
        var map = new Map(options);
        // Object Dynamic properties
        map.data = JSON.parse(JSON.stringify(map._params.data));
        map.y_length = map.data.length;
        map.x_length = map.data[0].length;
        map.imageData = null;
        // Object relationship
        map._stage = this;
        map._id = this.maps.length;
        this.maps.push(map);
        return map;
    };
    // Reset map
    Stage.prototype.resetMaps = function(){
        this.status = 1;
        this.maps.forEach(function(map){
            Object.assign(map,map._settings,map._params);
            map.data = JSON.parse(JSON.stringify(map._params.data));
            map.y_length = map.data.length;
            map.x_length = map.data[0].length;
            map.imageData = null;
        });
    };
    // Reset
    Stage.prototype.reset = function(){
        Object.assign(this,this._settings,this._params);
        this.resetItems();
        this.resetMaps();
    };
    // Bind event
    Stage.prototype.bind = function(eventType,callback){
        if(!_events[eventType]){
            _events[eventType] = {};
            window.addEventListener(eventType,function(e){
                var key = 's' + _index;
                if(_events[eventType][key]){
                    _events[eventType][key](e);
                }
                e.preventDefault();
            });
        }
        _events[eventType]['s'+this.index] = callback.bind(this);	// Bind scope
    };
    // Start Animation
    this.start = function() {
        var f = 0;		//Frame Rate
        var timestamp = (new Date()).getTime();
        var fn = function(){
            var now = (new Date()).getTime(); 
            if(now-timestamp<16){   // frame rate 60
                _hander = requestAnimationFrame(fn);
                return false;
            }
            timestamp = now;
            var stage = _stages[_index];
            _context.clearRect(0,0,_.width,_.height);		// Clear Canvas
            _context.fillStyle = '#000'; //Background game color
            _context.fillRect(0,0,_.width,_.height);  //Need to modify this for outter color to stay statically black/inner blue/green
            f++;
            if(stage.timeout){
                stage.timeout--;
            }
            if(stage.update()!=false){		            // If update false do not draw
                stage.maps.forEach(function(map){
                    if(!(f%map.frames)){
                        map.times = f/map.frames;		// Counter
                    }
                    if(map.cache){
                        if(!map.imageData){
                            _context.save();
                            map.draw(_context);
                            map.imageData = _context.getImageData(0,0,_.width,_.height);
                            _context.restore();
                        }else{
                            _context.putImageData(map.imageData,0,0);
                        }
                    }else{
                    	map.update();
                        map.draw(_context);
                    }
                });
                stage.items.forEach(function(item){
                    if(!(f%item.frames)){
                        item.times = f/item.frames;		   // Counter
                    }
                    if(stage.status==1&&item.status!=2){  	// Game in play
                        if(item.location){
                            item.coord = item.location.position2coord(item.x,item.y);
                        }
                        if(item.timeout){
                            item.timeout--;
                        }
                        item.update();
                    }
                    item.draw(_context);
                });
            }
            _hander = requestAnimationFrame(fn);
        };
        _hander = requestAnimationFrame(fn);
    };
    // End animation
    this.stop = function(){
        _hander&&cancelAnimationFrame(_hander);
    };
    // Event Coordinate
    this.getPosition = function(e){
        var box = $canvas.getBoundingClientRect();
        return {
            x:e.clientX-box.left*(_.width/box.width),
            y:e.clientY-box.top*(_.height/box.height)
        };
    }
    // Create stage
    this.createStage = function(options){
        var stage = new Stage(options);
        stage.index = _stages.length;
        _stages.push(stage);
        return stage;
    };
    // Set Stage
    this.setStage = function(index){
        _stages[_index].status = 0;
        _index = index;
        _stages[_index].status = 1;
        _stages[_index].reset(); // reset
        return _stages[_index];
    };
    // Next Stage
    this.nextStage = function(){
        if(_index<_stages.length-1){
            return this.setStage(++_index);
        }else{
            throw new Error('unfound new stage.');
        }
    };
    // Return list of stages
    this.getStages = function(){
        return _stages;
    };
    // Initialise game
    this.init = function(){
        _index = 0;
        this.start();
    };
}
