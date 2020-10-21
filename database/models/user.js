module.exports = function ({ sequelize, Sequelize }) {
	let User = sequelize.define('user', {
		num: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		name: {
			type: Sequelize.STRING
		},
		uid: {
			type: Sequelize.BIGINT,
			unique: true
		},
		point: {
			type: Sequelize.BIGINT,
			defaultValue: 0
		},
		block: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		},
		afk: {
			type: Sequelize.BOOLEAN,
			defaultValue: false
		},
		reasonafk: {
			type: Sequelize.STRING
		}
		
	});
	return User;
}