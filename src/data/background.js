// Get rules
importScripts("rules.js");


// Vars

var cached_rules = {},
	whitelisted_domains = {},
	tab_list = {};


// Common functions

function getHostname(url, cleanup)
{
	try
	{
		if (url.indexOf('http') != 0)
			throw true;
		
		var a = new URL(url);
		
		return (typeof cleanup == 'undefined' ? a.hostname : a.hostname.replace(/^w{2,3}\d*\./i, ''));
	}
	catch(error)
	{
		return false;
	}
}


// Whitelisting

function updateWhitelist()
{
	chrome.storage.local.get('whitelisted_domains', function(r) {
		if (typeof r.whitelisted_domains != 'undefined')
			whitelisted_domains = r.whitelisted_domains;
		
		updateDynamicRules();
	});
}

updateWhitelist();

chrome.runtime.onMessage.addListener(function(request, info){
	if (request == 'update_whitelist')
		updateWhitelist();
});

function isWhitelisted(tab)
{
	if (typeof whitelisted_domains[tab.hostname] != 'undefined')
		return true;
	
	for (var i in tab.host_levels)
		if (typeof whitelisted_domains[tab.host_levels[i]] != 'undefined')
			return true;
	
	return false;
}

function getWhitelistedDomain(tab)
{
	if (typeof whitelisted_domains[tab.hostname] != 'undefined')
		return tab.hostname;
	
	for (var i in tab.host_levels)
		if (typeof whitelisted_domains[tab.host_levels[i]] != 'undefined')
			return tab.host_levels[i];
	
	return false;
}

function toggleWhitelist(tab)
{
	if (tab.url.indexOf('http') != 0 || !tab_list[tab.id])
		return;
	
	if (tab_list[tab.id].whitelisted)
	{
		var hostname = getWhitelistedDomain(tab_list[tab.id]);
		delete whitelisted_domains[tab_list[tab.id].hostname];
	}
	else
		whitelisted_domains[tab_list[tab.id].hostname] = true;
	
	updateDynamicRules();
	
	chrome.storage.local.set({'whitelisted_domains': whitelisted_domains}, function(){
		for (var i in tab_list)
			if (tab_list[i].hostname == tab_list[tab.id].hostname)
				tab_list[i].whitelisted = !tab_list[tab.id].whitelisted;
	});
}


// Maintain tab list

function getPreparedTab(tab)
{
	tab.hostname = false;
	tab.whitelisted = false;
	tab.host_levels = [];
	
	if (tab.url)
	{
		tab.hostname = getHostname(tab.url, true);
		
		if (tab.hostname)
		{
			var parts = tab.hostname.split('.');
			
			for (var i=parts.length; i>=2; i--)
				tab.host_levels.push(parts.slice(-1*i).join('.'));
			
			tab.whitelisted = isWhitelisted(tab);
		}
	}
	
	return tab;
}

function onCreatedListener(tab)
{
    tab_list[tab.id] = getPreparedTab(tab);
}

function onUpdatedListener(tabId, changeInfo, tab) {
	if (changeInfo.status)
		tab_list[tab.id] = getPreparedTab(tab);
}

function onRemovedListener(tabId) {
    if (tab_list[tabId])
		delete tab_list[tabId];
}

function recreateTabList()
{
	tab_list = {};
	
	chrome.tabs.query({}, function(results) {
		results.forEach(onCreatedListener);
		
		for (var i in tab_list)
			doTheMagic(tab_list[i].id);
	});
}

chrome.tabs.onCreated.addListener(onCreatedListener);
chrome.tabs.onUpdated.addListener(onUpdatedListener);
chrome.tabs.onRemoved.addListener(onRemovedListener);

chrome.runtime.onStartup.addListener(function(d){
	cached_rules = {};
	recreateTabList();
});

chrome.runtime.onInstalled.addListener(function(d){
	cached_rules = {};
	
	if (d.reason == "update" && chrome.runtime.getManifest().version > d.previousVersion)
		recreateTabList();
});


// URL blocking

function updateDynamicRules() {
	var domains = Object.keys(whitelisted_domains);
	
	if (domains.length == 0)
		domains[0] = 'example.com';
	
	block_urls.addRules[0].condition.requestDomains = domains;
	
	chrome.declarativeNetRequest.updateDynamicRules({
		addRules: [block_urls.addRules[0]],
		removeRuleIds: [1]
	});
}

chrome.declarativeNetRequest.updateDynamicRules(block_urls);


// Reporting

function reportWebsite(info, tab)
{
	if (tab.url.indexOf('http') != 0 || !tab_list[tab.id])
		return;
	
	
	var hostname = getHostname(tab.url);
	
	if (hostname.length == 0)
		return;
	
	
	if (tab_list[tab.id].whitelisted)
	{
		return chrome.notifications.create('report', {
			type: "basic",
			title: chrome.i18n.getMessage("reportSkippedTitle", hostname),
			message: chrome.i18n.getMessage("reportSkippedMessage"),
			iconUrl: "icons/48.png"
		});
	}
	
	
	chrome.tabs.create({url:"https://www.i-dont-care-about-cookies.eu/report/"+chrome.runtime.getManifest().version+'/'+encodeURIComponent(encodeURIComponent(tab.url))});
}


// Adding custom CSS/JS

function activateDomain(hostname, tabId, frameId)
{
	if (!cached_rules[hostname])
		cached_rules[hostname] = rules[hostname] || {};
	
	if (!cached_rules[hostname])
		return false;
	
	let r = cached_rules[hostname],
		status = false;
	
	
	let target = {tabId: tabId};
	
	if (frameId)
		target.frameIds = [frameId];
	
	
	if (typeof r.s != 'undefined') {
		chrome.scripting.insertCSS({target: target, css: r.s});
		status = true;
	}
	else if (typeof r.c != 'undefined') {
		chrome.scripting.insertCSS({target: target, css: commons[r.c]});
		status = true;
	}
	
	if (typeof r.j != 'undefined') {
		chrome.scripting.executeScript({target: target, files: ['data/js/'+(r.j > 0 ? 'common'+r.j : hostname)+'.js']});
		status = true;
	}
	
	return status;
}


function doTheMagic(tabId, frameId, anotherTry)
{
	if (!tab_list[tabId] || tab_list[tabId].url.indexOf('http') != 0)
		return;
	
	if (tab_list[tabId].whitelisted)
		return;
	
	
	let target = {tabId: tabId};
	
	if (frameId)
		target.frameIds = [frameId];
	
	
	// Common CSS rules
	chrome.scripting.insertCSS({target: target, files: ["data/css/common.css"]}, () => {
	
		// A failure? Retry.
		
		if (chrome.runtime.lastError) {
			let currentTry = (anotherTry || 1);
			
			if (currentTry == 5)
				return;
			
			return doTheMagic(tabId, frameId || 0, currentTry + 1);
		}
		
		
		// Common social embeds
		chrome.scripting.executeScript({target: target, files: ["data/js/embeds.js"]});
		
		if (activateDomain(tab_list[tabId].hostname, tabId, frameId || 0))
			return;
		
		for (var level in tab_list[tabId].host_levels)
			if (activateDomain(tab_list[tabId].host_levels[level], tabId, frameId || 0))
				return true;
		
		// Common JS rules when custom rules don't exist
		chrome.scripting.executeScript({target: target, files: ["data/js/common.js"]});
	});
}


chrome.webNavigation.onCommitted.addListener(function(tab) {
	if (tab.frameId > 0)
		return;
	
	tab_list[tab.tabId] = getPreparedTab(tab);
	
	doTheMagic(tab.tabId);
});


chrome.webRequest.onResponseStarted.addListener(function(tab) {
	if (tab.frameId > 0)
		doTheMagic(tab.tabId, tab.frameId);
}, {urls: ['<all_urls>'], types: ['sub_frame']});


// Update notification

chrome.runtime.onInstalled.addListener(function(d){
	if (d.reason == "update" && chrome.runtime.getManifest().version > d.previousVersion)
	{
// 		chrome.tabs.create({url:"https://www.i-dont-care-about-cookies.eu/whats-new/acquisition/"});
		
// 		chrome.notifications.create('update', {
// 			type: "basic",
// 			title: "Big summer update - I don't care about cookies",
// 			message: "Support the project, please. Visit i-dont-care-about-cookies.eu",
// 			iconUrl: "icons/48.png"/*,
// 			buttons:[{title: chrome.i18n.getMessage("menuSupport")}]*/
// 		});
// 		
// 		// chrome.notifications.onButtonClicked.addListener(function(){
// 		//	chrome.tabs.create({url:"https://www.i-dont-care-about-cookies.eu/"});
// 		// });
	}
	
	if (d.reason == "install") {
		chrome.storage.local.get('is_installed', function(r) {
			if (typeof r.is_installed == 'undefined') {
				chrome.storage.local.set({'is_installed': true}, function() {
// 					chrome.tabs.create({url:"https://www.i-dont-care-about-cookies.eu"});
				});
			}
		});
	}
});


// Toolbar menu

chrome.runtime.onMessage.addListener(function(request, info, sendResponse) {
	if (typeof request == 'object')
	{
		if (request.tabId && tab_list[request.tabId])
		{
			if (request.command == 'get_active_tab')
			{
				var response = {tab: tab_list[request.tabId]};
				
				if (response.tab.whitelisted)
					response.tab.hostname = getWhitelistedDomain(tab_list[request.tabId]);
				
				sendResponse(response);
			}
			else if (request.command == 'toggle_extension')
				toggleWhitelist(tab_list[request.tabId]);
			else if (request.command == 'report_website')
				chrome.tabs.create({url:"https://www.i-dont-care-about-cookies.eu/report/"+chrome.runtime.getManifest().version+'/'+encodeURIComponent(encodeURIComponent(tab_list[request.tabId].url))});
			else if (request.command == 'refresh_page') {
				chrome.scripting.executeScript({
					target: {tabId: request.tabId},
					func: function() {
						window.location.reload();
					}
				});
			}
		}
		else
		{
			if (request.command == 'open_support_page')
				chrome.tabs.create({url:"https://www.i-dont-care-about-cookies.eu/"});
			else if (request.command == 'open_options_page')
				chrome.tabs.create({url:chrome.runtime.getURL('data/options.html')});
		}
	}
});