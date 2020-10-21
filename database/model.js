require('dotenv').config();
module.exports = function ({ Sequelize, sequelize }) {
	const force = process.env.NODE_ENV == 'development',
		  user = require("./models/user")({ sequelize, Sequelize }),
		  thread = require("./models/thread")({ sequelize, Sequelize }),
		  fishing = require("./models/fishing")({ sequelize, Sequelize }),
		  economy = require("./models/economy")({ sequelize, Sequelize }),
		  nsfw = require("./models/nsfw")({ sequelize, Sequelize });
	user.sync({ force });
	thread.sync({ force });
	fishing.sync({ force });
	economy.sync({ force });
	nsfw.sync({ force });
	return {
		model: {
			user,
			thread,
			fishing,
			economy,
			nsfw
		},
		use: function (modelName) {
			return this.model[`${modelName}`];
		}
	}
}