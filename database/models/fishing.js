module.exports = function ({ sequelize, Sequelize }) {
	let Fishing = sequelize.define('fishing', {
		num: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		uid: {
			type: Sequelize.BIGINT,
			unique: true
		},
		lastTimeFishing: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		inventory: {
			type: Sequelize.JSON,
		},
		stats: {
			type: Sequelize.JSON,
		}
		
	});
	return Fishing;
}