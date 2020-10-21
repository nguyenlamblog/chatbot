require("dotenv").config();
const path = require("path");
module.exports = { //Hãy sửa trong file .env những dòng ghi process.env
	development: false,
	prefix: process.env.PREFIX,
	canCheckUpdate: true,
	botName: process.env.BOT_NAME,
	googleSearch: process.env.GOOGLE_SEARCH,
	wolfarm: process.env.WOLFARM,
	yandex: process.env.YANDEX,
	tenor: process.env.TENOR,
	openweather: process.env.OPENWEATHER,
	saucenao: process.env.SAUCENAO,
	waketime: process.env.WAKETIME,
	sleeptime: process.env.SLEEPTIME,
	admins: (process.env.ADMINS || '').split('_').map(e => parseInt(e)),
	nsfwGodMode: false,
	database: {
		postgres: {
			database: 'postgres',
			username: 'postgres',
			password: 'root',
			host: 'localhost',
		},
		sqlite: {
			storage: path.resolve(__dirname, "./data.sqlite"),
		},
	},
	appStateFile: path.resolve(__dirname, '../appstate.json')
}