const logger = require("../modules/log.js");
module.exports = function({ models, api, Economy }) {
	const Nsfw = models.use("nsfw");

	/* ==================== NSFW ==================== */
	
	function getNSFW(uid) {
		return Nsfw.findOne({
			where: {
				uid
			}
		}).then(function(nsfw) {
			if (!nsfw) return;
			return nsfw.get({ plain: true }).nsfwTier;
		}).catch(err => {
			logger(err, 2);
			return false;
		})
	}

	function setNSFW(uid, nsfwTier) {
		return Nsfw.findOne({
			where: {
				uid
			}
		}).then(function(nsfw) {
			if (!nsfw) return;
			if (nsfwTier == 0) return nsfw.update({ nsfwTier, hentaiLeft: 2, pornLeft: 1 });
			else if (nsfwTier == 1) return nsfw.update({ nsfwTier, hentaiLeft: 4, pornLeft: 2 });
			else if (nsfwTier == 2) return nsfw.update({ nsfwTier, hentaiLeft: 8, pornLeft: 4 });
			else if (nsfwTier == 3) return nsfw.update({ nsfwTier, hentaiLeft: 12, pornLeft: 6 });
			else if (nsfwTier == 4) return nsfw.update({ nsfwTier, hentaiLeft: 16, pornLeft: 8 });
			else if (nsfwTier == 5) return nsfw.update({ nsfwTier, hentaiLeft: -1, pornLeft: 10 });
			else if (nsfwTier == -1) return nsfw.update({ nsfwTier, hentaiLeft: -1, pornLeft: -1 }); //God Mode
		}).catch(err => {
			logger(err, 2);
			return false;
		})
	}

	function buyNSFW(uid) {
		return Nsfw.findOne({
			where: {
				uid
			}
		}).then(async function(nsfw) {
			if (!nsfw) return;
			let myTier = await getNSFW(uid);
			var money = await Economy.getMoney(uid);
			if (myTier == 5) return 'Không thể mua thêm vì bạn đã ở Hạng 5';
			const price = [2000, 6000, 10000, 14000, 20000];
			const tier = [1, 2, 3, 4, 5];
			var needPrice = price[tier.indexOf(myTier + 1)];
			if (money < needPrice) return 'Làm chưa mà đòi ăn? Vẫn còn thiếu ' + (needPrice - money) + ' đô kìa.';
			else {
				var getReturn = await Economy.subtractMoney(uid, needPrice);
				if (getReturn == true) {
					setNSFW(uid, myTier + 1);
					return 'Đã làm thì phải có ăn! Mua thành công Hạng ' + (myTier + 1) + '!';
				}
			}
		}).catch(function(error) {
			logger(error, 2);
			return false;
		})
	}

	function pornUseLeft(uid) {
		return Nsfw.findOne({
			where: {
				uid
			}
		}).then(function(nsfw) {
			if (!nsfw) return;
			return nsfw.get({ plain: true }).pornLeft;
		}).catch(err => {
			logger(err, 2);
			return false;
		})
	}

	function hentaiUseLeft(uid) {
		return Nsfw.findOne({
			where: {
				uid
			}
		}).then(function(nsfw) {
			if (!nsfw) return;
			return nsfw.get({ plain: true }).hentaiLeft;
		}).catch(err => {
			logger(err, 2);
			return false;
		})
	}

	function subtractHentai(uid) {
		return Nsfw.findOne({
			where: {
				uid
			}
		}).then(async function(nsfw) {
			if (!nsfw) return;
			var useLeft = await hentaiUseLeft(uid);
			return nsfw.update({ hentaiLeft: useLeft - 1 })
		}).catch(err => {
			logger(err, 2);
			return false;
		})
	}

	function subtractPorn(uid) {
		return Nsfw.findOne({
			where: {
				uid
			}
		}).then(async function(nsfw) {
			if (!nsfw) return;
			var useLeft = await pornUseLeft(uid);
			return nsfw.update({ pornLeft: useLeft - 1 })
		}).catch(err => {
			logger(err, 2);
			return false;
		})
	}

	function resetNSFW() {
		try {
			Nsfw.update({ hentaiLeft: 2, pornLeft: 1 }, {where: {nsfwTier: 0}});
			Nsfw.update({ hentaiLeft: 4, pornLeft: 2 }, {where: {nsfwTier: 1}});
			Nsfw.update({ hentaiLeft: 8, pornLeft: 4 }, {where: {nsfwTier: 2}});
			Nsfw.update({ hentaiLeft: 12, pornLeft: 6 }, {where: {nsfwTier: 3}});
			Nsfw.update({ hentaiLeft: 16, pornLeft: 8 }, {where: {nsfwTier: 4}});
			Nsfw.update({ hentaiLeft: -1, pornLeft: 10 }, {where: {nsfwTier: 5}});
			return true
		}
		catch (err) {
			logger(err, 2);
			return false;
		}
	}

	return {
		getNSFW,
		buyNSFW,
		setNSFW,
		pornUseLeft,
		hentaiUseLeft,
		subtractPorn,
		subtractHentai,
		resetNSFW
	};
};
