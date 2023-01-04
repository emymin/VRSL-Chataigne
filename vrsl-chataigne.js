var fixtures;
var groups;
var channel_info;
var fixture_info;
var parameterPath;

function init(){
    script.log("VRSL-Chataigne initialized");
    if(local.parameters.setup.fixtures.get()!=""){
        loadFixtures();
    }else{
        script.log("Please set a path to the fixtures definition file");
    }
}

function loadFixtures(){
    script.log("Loading fixtures...");

    var definitions = util.readFile(local.parameters.setup.definitions.get(),true);
    channel_info = definitions["channel_info"];
    fixture_info = definitions["fixture_info"];

    var configuration = util.readFile(local.parameters.setup.fixtures.get(),true);
    fixtures = configuration["fixtures"];
    groups = configuration["groups"];
    
    parameterPath = local.getChild("Parameters");
    var fixturesContainer = parameterPath.addContainer("Fixtures");
    fixturesContainer.setCollapsed(true);
    var groupsContainer = parameterPath.addContainer("Groups");
    groupsContainer.setCollapsed(true);
    
    var fixtureKeys = util.getObjectProperties(fixtures); 
    for(var i=0;i<fixtureKeys.length;i++){
        var key = fixtureKeys[i];
        var channels = util.getObjectProperties(fixture_info[fixtures[key].type]);
        createParameters(fixturesContainer.addContainer(key),key,channels);
    }
    var groupKeys = util.getObjectProperties(groups);
    for(var i=0;i<groupKeys.length;i++){
        var key = groupKeys[i];
        createParameters(groupsContainer.addContainer(key),key,groups[key].parameters);
    }
    script.log("Loaded "+fixtureKeys.length+" fixtures and "+groupKeys.length+" groups");
}
function createParameters(container,name,channels){
    script.log("Creating parameters for "+name);
    for(var i=0;i<channels.length;i++){
        var channelName = channels[i];
        var channelDescription = channel_info[channelName].description;
        var channelLength = channel_info[channelName].length;
        var p;
        if(channelLength==1){
            p = container.addFloatParameter(channelName,channelDescription,0);
        }else if(channelLength==2){
            p = container.addPoint2DParameter(channelName,channelDescription,[0,0]);
        }else if(channelLength==3){
            p = container.addColorParameter(channelName,channelDescription,[0,0,0,1]);
        }else{
            script.log("Unsupported parameter length");
        }
        p.setAttribute("alwaysNotify", true);
    }
    script.log("Parameters created for "+name);
}
function moduleParameterChanged(param){
    script.log("Parameter "+param.name+": "+param);

    if(param.is(local.outActivity)) return;
    if(param.name=="loadFixtures") {loadFixtures(); return;}
    if(param.name=="clearDMX") {clearDMX(); return;}
    
    script.log("Parameter data: "+param.get());
    var isGroup = param.getParent().getParent().name=="groups";
    var group_or_fixture_name = param.getParent().name;
    var channel_name = param.name;
    var channel_length = channel_info[channel_name].length;
    var value = param.get();
    
    if(!value.length){value = [value];}
    if(value.length!=channel_length){
        script.log("Received "+channel_name+" value of length "+value.length+" that doesn't match definition length of "+channel_length);
    }

    var fixtures_to_modify = [];
    var members_to_modify = [];
    if(isGroup){
        members_to_modify = groups[group_or_fixture_name].members;
        var member_names = util.getObjectProperties(members_to_modify);
        for(var i=0;i<member_names.length;i++){
            fixtures_to_modify.push(member_names[i]);
        }
    }else{
        fixtures_to_modify.push(group_or_fixture_name);
    }
    for(var i=0;i<channel_length;i++){
        var range = channel_info[channel_name].range;
        if(range){
            value[i] = (value[i]-range[0]) / (range[1]-range[0]);
        }
        value[i] = Math.max(0,Math.min(255,value[i]*255));
    }

    for(var i=0;i<fixtures_to_modify.length;i++){
        var fixture_name = fixtures_to_modify[i];
        var sector = fixtures[fixture_name].sector;
        var mapping = fixture_info[fixtures[fixture_name].type][channel_name].mapping;
        script.log("\nFixture name: "+fixture_name+"\nSector: "+sector+"\nChannel name: "+channel_name);
        for(var j=0;j<channel_length;j++){
            var final_value = value[j];
            if( isGroup && (channel_name=="pantilt" || channel_name=="finepantilt") && members_to_modify[fixture_name].flip && j==1){
                final_value = 255-final_value;
            }
            var channel_offset = mapping[j];
            var dmx_channel = sector * 13 + channel_offset;
            script.log("Sending "+final_value+" to DMX Channel "+dmx_channel);
            local.send(dmx_channel,final_value);
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

function getParameter(fixture_name, channel) {
	pathName = fixture_name.toLowerCase().replace(" ","");
	var isGroup = groups[fixture_name];
    var parameter;
	if (isGroup) {
		parameter =  parameterPath.groups[pathName][channel];
	} else {
		parameter = parameterPath.fixtures[pathName][channel];
	}
    return parameter;
}
function setChannelParameter(fixture_name,channel_name,value){
    if(fixture_name!=""){
        var parameter = getParameter(fixture_name,channel_name);
        if(!parameter){script.log("Fixture "+fixture_name+" of type "+fixtures[fixture_name].type+" doesn't have channel "+channel_name); return;}
        parameter.set(value);
    }
}

//callbacks

function setColor (fixture, color) { setChannelParameter(fixture,"color",color);}
function setPanTilt(fixture,pantilt){setChannelParameter(fixture,"pantilt",pantilt);}
function setFinePanTilt(fixture,finepantilt){setChannelParameter(fixture,"finepantilt",finepantilt);}
function setConeWidth(fixture,conewidth){setChannelParameter(fixture,"conewidth",conewidth);}
function setIntensity(fixture,intensity){setChannelParameter(fixture,"intensity",intensity);}
function setStrobe(fixture,strobe){setChannelParameter(fixture,"strobe",strobe);}
function setGOBOSelect(fixture,goboselect){setChannelParameter(fixture,"goboselect",goboselect);}
function setGOBOSpeed(fixture,gobospeed){setChannelParameter(fixture,"gobospeed",gobospeed);}
function setNamedChannel(fixture,channelname,value){setChannelParameter(fixture,channelname,value);}

function setGenericChannel(sector,channel,value){
    var address = sector*13+channel;
    var value = Math.max(0,Math.min(255,value));
    script.log("Sending "+value+" to sector "+sector+" channel "+channel+", DMX Channel "+address);
    local.send(sector*13+channel,value);
}

