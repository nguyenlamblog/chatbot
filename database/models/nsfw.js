module.exports = function ({ sequelize, Sequelize }) {
	let Nsfw = sequelize.define('nsfw', {
		num: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		uid: {
			type: Sequelize.BIGINT,
			unique: true
		},
		nsfwTier: {
			type: Sequelize.INTEGER,
			defaultValue: 0
		},
		pornLeft: {
			type: Sequelize.INTEGER,
			defaultValue: 1
		},
		hentaiLeft: {
			type: Sequelize.INTEGER,
			defaultValue: 2
		}
		
	});
	return Nsfw;
}