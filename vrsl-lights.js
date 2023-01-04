var fixtures;

var descriptions = {
    "pantilt":"Pan and Tilt of the light",
    "finepantilt":"Finer Pan and Tilt of the light",
    "conewidth":"Spotlight radius",
    "intensity":"Intensity of the light",
    "strobe":"Strobe effect (0-009 is off, 010-255 is slow to fast)",
    "color":"Color of the light",
    "goboselect":"GOBO Selection (0 is no gobo, 1-6 are various gobos)",
    "gobospeed":"Speed at which the GOBO spins",
    "moverspeed":"Mover Speed",
    "length":"Length of the beams",
    "width":"Width of the beams",
    "flatness":"Flatness of the beams",
    "beamcount":"Amount of beams",
    "beamthickness":"Thickness of the beams",
    "spinspeed":"Speed at which the beams spin"
};

var definition = {
    "spotlight":{
        "pantilt":{"mapping":[1,3]},
        "finepantilt":{"mapping":[2,4]},
        "conewidth":{"mapping":[5]},
        "intensity":{"mapping":[6]},
        "strobe":{"mapping":[7]},
        "color":{"mapping":[8,9,10]},
        "gobospeed":{"mapping":[11]},
        "goboselect":{"mapping":[12]},
        "moverspeed":{"mapping":[13]}
    },
    "washlight":{
        "pantilt":{"mapping":[1,3]},
        "finepantilt":{"mapping":[2,4]},
        "conewidth":{"mapping":[5]},
        "intensity":{"mapping":[6]},
        "strobe":{"mapping":[7]},
        "color":{"mapping":[8,9,10]},
        "gobospeed":{"mapping":[13]}
    },
    "laser":{
        "pantilt":{"mapping":[1,2]},
        "length":{"mapping":[3]},
        "width":{"mapping":[4]},
        "flatness":{"mapping":[5]},
        "beamcount":{"mapping":[6]},
        "spinspeed":{"mapping":[7]},
        "color":{"mapping":[8,9,10]},
        "intensity":{"mapping":[11]},
        "beamthickness":{"mapping":[12]},
        "moverspeed":{"mapping":[13]}
    },
    "discoball":{
        "intensity":{"mapping":[1]}
    },
    "flasher":{
        "intensity":{"mapping":[1]}
    },
    "blinder":{
        "intensity":{"mapping":[1]},
        "color":{"mapping":[2,3,4]},
        "strobe":{"mapping":[5]}
    },
    "barlight":{
        "intensity":{"mapping":[1]},
        "color":{"mapping":[2,3,4]},
        "strobe":{"mapping":[5]}
    },
    "parlight":{
        "intensity":{"mapping":[1]},
        "color":{"mapping":[2,3,4]},
        "strobe":{"mapping":[5]}
    }
};

function init(){
    script.log("VRSL-LIGHTS initialized");
    if(local.parameters.setup.fixtures.get()!=""){
        loadFixtures();
    }else{
        script.log("Please set a path to the fixtures definition file");
    }
}

function loadFixtures(){
    script.log("Loading fixtures...");
    fixtures = util.readFile(local.parameters.setup.fixtures.get(),true);
    var fixtureKeys = util.getObjectProperties(fixtures); 

    parameterPath = local.getChild("Parameters");
    var lightsContainer = parameterPath.addContainer("Lights");
    lightsContainer.setCollapsed(true);
    var groupsContainer = parameterPath.addContainer("Groups");
    groupsContainer.setCollapsed(true);

    for(var i=0;i<fixtureKeys.length;i++){
        var key = fixtureKeys[i];
        var isGroup = (fixtures[key].type=="group");
        var container = isGroup ? groupsContainer.addContainer(key) : lightsContainer.addContainer(key);
        createParameters(container,key,fixtures[key].type);
    }
}
function createParameters(container,name,type){
    var definitionKeys = util.getObjectProperties(definition[type]);
    if(type=="group")
    for(var i=0;i<definitionKeys.length;i++){
        var channelName = definitionKeys[i];
        script.log(channelName+": "+descriptions[channelName]);
        var length = definition[type][channelName].mapping.length;
        var p;
        if(length==1){
            p = container.addFloatParameter(channelName,descriptions[channelName],0);
        }else if(length==2){
            p = container.addPoint2DParameter(channelName,descriptions[channelName],[0,0]);
        }else if(length==3){
            p = container.addColorParameter(channelName,descriptions[channelName],[0,0,0,1]);
        }else{
            script.log("Unsupported parameter length");
        }
        p.setAttribute("alwaysNotify", true);
    }
}
function moduleParameterChanged(param){
    script.log("Parameter "+param.name+": "+param);

    if(param.is(local.outActivity)) return;
    if(param.name=="loadFixtures") {loadFixtures(); return;}
    if(param.name=="clearDMX") {clearDMX(); return;}
    
    script.log("Parameter data: "+param.get());
    var isGroup = param.getParent().getParent().name=="groups";
    var group_or_light_name = param.getParent().name;
    var channel_name = param.name;
    
    var value = param.get();
    if(!value.length){value = [value];}
    if(value.length!=definition[channel_name].mapping.length){
        script.log("Received "+channel_name+" value of length "+value.length+" that doesn't match definition length of "+definition[channel_name].mapping.length);
    }

    var lights = [];
    var members = [];
    if(isGroup){
        members = fixtures[group_or_light_name].members;
        var memberkeys = util.getObjectProperties(members);
        for(var i=0;i<memberkeys.length;i++){
            lights.push(memberkeys[i]);
        }
    }else{
        lights.push(group_or_light_name);
    }
    for(var i=0;i<value.length;i++){

        if(channel_name=="pantilt" || channel_name=="finepantilt"){
            value[i] = (value[i]+1)*0.5;
        }

        if(channel_name=="goboselect"){
            value[i] = Math.max(0,Math.min(6,value[i]));
        }else if(channel_name=="strobe"){
            value[i] = Math.max(0,Math.min(255,value[i]));
        }else{
            value[i] = Math.max(0,Math.min(255,value[i]*255));
        }
    }

    for(var i=0;i<lights.length;i++){
        var light_name = lights[i];
        var address = fixtures[light_name].address;
        script.log("Light name: "+light_name+"\nAddress: "+address+"\nChannel name: "+channel_name);
        for(var j=0;j<definition[channel_name].mapping.length;j++){
            var converted = value[j];
            if( isGroup && (channel_name=="pantilt" || channel_name=="finepantilt") && members[light_name].flip && j==1){
                converted = 255-converted;
            }
            var offset = definition[channel_name].mapping[j];
            var dmx_channel = address * 13 + offset;
            script.log("Sending "+converted+" to DMX Channel "+dmx_channel);
            local.send(dmx_channel,converted);
        }

    };
}
function clearDMX() {
	var channels = [];
	
	for(var i=0; i < 512; i++) {
		channels.push(0);
	}
	
	local.send(1, channels);
    script.log("Clearing DMX");
	loadFixtures();
}

function getParameter(light, channel) {
	pathName = light.toLowerCase().replace(" ","");
	var type = fixtures[light].type;
    var parameter;
	if (type == "group") {
		parameter =  parameterPath.groups[pathName][channel];
	} else {
		parameter = parameterPath.lights[pathName][channel];
	}
    return parameter;
}
function setChannelParameter(light_name,channel_name,value){
    if(light_name!=""){
        var parameter = getParameter(light_name,channel_name);
        if(!parameter){script.log("Light "+light_name+" of type "+fixtures[light_name].type+" doesn't have channel "+channel_name); return;}
        parameter.set(value);
    }
}

//callbacks

function setColor (light, color) { setChannelParameter(light,"color",color);}
function setPanTilt(light,pantilt){setChannelParameter(light,"pantilt",pantilt);}
function setFinePanTilt(light,finepantilt){setChannelParameter(light,"finepantilt",finepantilt);}
function setConeWidth(light,conewidth){setChannelParameter(light,"conewidth",conewidth);}
function setIntensity(light,intensity){setChannelParameter(light,"intensity",intensity);}
function setStrobe(light,strobe){setChannelParameter(light,"strobe",strobe);}
function setGOBOSelect(light,goboselect){setChannelParameter(light,"goboselect",goboselect);}
function setGOBOSpeed(light,gobospeed){setChannelParameter(light,"gobospeed",gobospeed);}

function setGenericChannel(sector,channel,value){
    var address = sector*13+channel;
    var value = Math.max(0,Math.min(255,value));
    script.log("Sending "+value+" to sector "+sector+" channel "+channel+", DMX Channel "+address);
    local.send(sector*13+channel,value);
}

