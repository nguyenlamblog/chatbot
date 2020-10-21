const jimp = require("jimp");
const text2png = require("text2png");
const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");
const __root = path.resolve(__dirname, "../material");

module.exports = async function(data) {
	const { id, name, level, expCurrent, expNextLevel } = data;
	let fontpath = ["AvantGarde_Demi.ttf", "AvantGarde.ttf"].map(e => path.resolve(__root, "./font/", e));
	let getData = await axios.get(`https://graph.facebook.com/${id}/picture?width=512`, { responseType: 'arraybuffer' });
	let buffer = Buffer.from(getData.data, 'utf-8');
	fs.writeFileSync(path.resolve(__root, `avt_${id}.png`), buffer);
	fs.writeFileSync(
		path.resolve(__root, "name_txt.png"),
		text2png(name, {
			color: "#ffffff",
			font: "28px AvantGarde-Demi",
			localFontPath: fontpath[0],
			localFontName: "AvantGarde-Demi"
		})
	);
	fs.writeFileSync(
		path.resolve(__root, "score_txt.png"),
		text2png(`${expCurrent} / ${expNextLevel}`, {
			color: "#85d7ea",
			font: "20px AvantGarde",
			localFontPath: fontpath[1],
			localFontName: "AvantGarde"
		})
	);
	fs.writeFileSync(
		path.resolve(__root, "level_txt.png"),
		text2png(level < 10 ? " " + level : level.toString(), {
			color: "#ffffff",
			font: "45px AvantGarde",
			localFontPath: fontpath[1],
			localFontName: "AvantGarde"
		})
	);
	let imgpath = ["bg.jpg", `avt_${id}.png`, "name_txt.png", "level_txt.png", "score_txt.png"].map(e => path.resolve(__root, e));
	let readJimp = [];
	imgpath.forEach(i => readJimp.push(jimp.read(i)));
	const [bg, avt, name_txt, level_txt, score_txt] = await Promise.all(readJimp);
	bg.composite(bg, 0, 0).composite(avt.resize(130, jimp.AUTO), 72, 40).composite(name_txt, 275, 110).composite(level_txt, 335, 45).composite(score_txt, 410, 147)
	const pathImg = path.resolve(__root, `../temp/${id}.png`);
	imgpath.forEach(item => (!item.includes('bg.jpg')) ? fs.unlinkSync(item) : '');
	return await new Promise((resolve) => bg.write(pathImg, () => resolve(pathImg)));
};
