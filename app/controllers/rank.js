const logger = require("../modules/log.js");
module.exports = function({ models, api }) {
	const User = models.use("user");
	const FACTOR = 3;

	function getPoint(uid) {
		return User.findOne({
			where: {
				uid
			}
		}).then(function(user) {
			if (!user) return;
			return user.get({ plain: true }).point;
		}).then(e => getInfo(e));
	}

	function updatePoint(uid, pointIncrement) {
		return User.findOne({
			where: {
				uid
			}
		}).then(function(user) {
			if (!user) return;
			const pointData = user.get({ plain: true }).point;
			return user.update({ point: pointData + pointIncrement });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	function setPoint(uid, point) {
		return User.findOne({
			where: {
				uid
			}
		}).then(function(user) {
			if (!user) return;
			return user.update({ point });
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		});
	}

	function expToLevel(point) {
		if (point < 0) return 0;
		return Math.floor((Math.sqrt(1 + (4 * point) / FACTOR) + 1) / 2);
	}

	function levelToExp(level) {
		if (level <= 0) return 0;
		return FACTOR * level * (level - 1);
	}

	function getInfo(point) {
		const level = expToLevel(point);
		const expCurrent = point - levelToExp(level);
		const expNextLevel = levelToExp(level + 1) - levelToExp(level);
		return { level, expCurrent, expNextLevel };
	}

	function getGlobalRank() {
		return User.findAll({ order: [['point', 'DESC']], attributes: ['num','uid','point']
		}).then(function(data) {
			if (!data) return;
			var value = [];
			data.forEach(item => value.push(item))
			return value;
		}).then(function() {
			return true;
		}).catch(function(error) {
			logger(error, 2);
			return false;
		})
	}

	return {
		getPoint,
		updatePoint,
		setPoint,
		expToLevel
	};
};
