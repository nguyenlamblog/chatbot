module.exports = function ({ sequelize, Sequelize }) {
	let Economy = sequelize.define('economy', {
		num: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		uid: {
			type: Sequelize.BIGINT,
			unique: true
		},
		money: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		dailytime: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		worktime: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		stealtime: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		}
		
	});
	return Economy;
}