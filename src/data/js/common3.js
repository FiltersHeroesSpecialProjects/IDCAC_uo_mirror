function getItem(hostname)
{
	switch (hostname)
	{
		case 'ants.gouv.fr': return {strict: true, key: 'cookieConsent', value: 'true'};
		case 'eqmac.app': return {strict: false, key: 'EQM_PRIVACY_CONSENT_CHOSEN', value: 'true'};
		case 'figuya.com': return {strict: false, key: 'cookie-dialog', value: 'closed'};
		case 'scoodleplay.be': return {strict: false, key: 'scoodleAllowCookies', value: 'true'};
		case 'lifesum.com': return {strict: false, key: 'accepted-cookies', value: '[]'};
		case 'programmitv.it': return {strict: false, key: 'privacy_choices_made', value: 'OK'};
		case 'nexus.gg': return {strict: true, key: 'cookie-notice:accepted', value: 'true'};
		case 'streamelements.com': return {strict: true, key: 'StreamElements.gdprNoticeAccepted', value: 'true'};
		case 'blaetterkatalog.welt.de': return {strict: true, key: 'DM_prefs', value: '{"cookie_hint":true,"accept_cookies":false,"_childs":[],"_type":1}'};
		
		case 'phoenix.de': return {strict: false, key: 'user_anonymous_profile', value: '{"config":{"tracking":false,"userprofile":false,"youtube":false,"twitter":false,"facebook":false,"iframe":false,"video":{"useSubtitles":false,"useAudioDescription":false}},"votings":[],"msgflash":[],"history":[]}'};
		
		case 'volkskrant.nl':
		case 'dg.nl':
		case 'demorgen.be':
		case 'trouw.nl':
		case 'ad.nl':
		case 'parool.nl':
		case 'ed.nl':
		case 'bndestem.nl':
		case 'weser-kurier.de':
			return [
				{strict: false, key: 'vl_disable_tracking', value: 'true'},
				{strict: false, key: 'vl_disable_usecookie', value: 'necessary'}
			];
	}
	
	
	const parts = hostname.split('.');
	
	if (parts.length > 2)
	{
		parts.shift();
		return getItem(parts.join('.'));
	}
	
	return false;
}


let	hostname = document.location.hostname.replace(/^w{2,3}\d*\./i, ''),
	counter = 0,
	items = getItem(hostname);

if (items) {
	(items instanceof Array ? items : [items]).forEach(function(item) {
		let value = localStorage.getItem(item.key);
		
		if (value == null || (item.strict && value != item.value)) {
			localStorage.setItem(item.key, item.value);
			counter++;
		}
	});
	
	if (counter > 0)
		document.location.reload();
}