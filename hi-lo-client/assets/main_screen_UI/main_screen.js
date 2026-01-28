
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class main_screen extends Phaser.Scene {

	constructor() {
		super("main_screen");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// bg
		const bg = this.add.image(534, 1343, "bg");
		bg.scaleX = 1.1;
		bg.scaleY = 1.5;

		// button_any_triple
		const button_any_triple = this.add.image(543, 868, "button_any triple");
		button_any_triple.scaleX = 0.75;
		button_any_triple.scaleY = 0.75;

		// button_big
		const button_big = this.add.image(950, 868, "button_big");
		button_big.scaleX = 0.75;
		button_big.scaleY = 0.75;

		// button_even
		const button_even = this.add.image(739, 868, "button_even");
		button_even.scaleX = 0.75;
		button_even.scaleY = 0.75;

		// button_odd
		const button_odd = this.add.image(347, 868, "button_odd");
		button_odd.scaleX = 0.75;
		button_odd.scaleY = 0.75;

		// button_small
		const button_small = this.add.image(135, 868, "button_small");
		button_small.scaleX = 0.75;
		button_small.scaleY = 0.75;

		// title_bigbox_yellow
		const title_bigbox_yellow = this.add.image(529, 1155, "title_bigbox_yellow");
		title_bigbox_yellow.scaleX = 0.75;
		title_bigbox_yellow.scaleY = 0.75;

		// title_on_double
		const title_on_double = this.add.image(535, 1014, "title_on_double");
		title_on_double.scaleX = 0.75;
		title_on_double.scaleY = 0.75;

		// number_00
		const number_00 = this.add.image(141, 1084, "number_00");
		number_00.scaleX = 0.75;
		number_00.scaleY = 0.75;

		// number_11
		const number_11 = this.add.image(335, 1082, "number_11");
		number_11.scaleX = 0.75;
		number_11.scaleY = 0.75;

		// number_22
		const number_22 = this.add.image(529, 1082, "number_22");
		number_22.scaleX = 0.75;
		number_22.scaleY = 0.75;

		// number_33
		const number_33 = this.add.image(725, 1082, "number_33");
		number_33.scaleX = 0.75;
		number_33.scaleY = 0.75;

		// number_44
		const number_44 = this.add.image(921, 1082, "number_44");
		number_44.scaleX = 0.75;
		number_44.scaleY = 0.75;

		// number_55
		const number_55 = this.add.image(139, 1154, "number_55");
		number_55.scaleX = 0.75;
		number_55.scaleY = 0.75;

		// number_66
		const number_66 = this.add.image(331, 1154, "number_66");
		number_66.scaleX = 0.75;
		number_66.scaleY = 0.75;

		// number_77
		const number_77 = this.add.image(527, 1154, "number_77");
		number_77.scaleX = 0.75;
		number_77.scaleY = 0.75;

		// number_88
		const number_88 = this.add.image(724, 1154, "number_88");
		number_88.scaleX = 0.75;
		number_88.scaleY = 0.75;

		// number_99
		const number_99 = this.add.image(920, 1154, "number_99");
		number_99.scaleX = 0.75;
		number_99.scaleY = 0.75;

		// title_bigbox_yellow_1
		const title_bigbox_yellow_1 = this.add.image(530, 1372, "title_bigbox_yellow");
		title_bigbox_yellow_1.scaleX = 0.75;
		title_bigbox_yellow_1.scaleY = 0.75;

		// title_on_triple
		const title_on_triple = this.add.image(532, 1231, "title_on_triple");
		title_on_triple.scaleX = 0.75;
		title_on_triple.scaleY = 0.75;

		// number_000
		const number_000 = this.add.image(138, 1311, "number_000");
		number_000.scaleX = 0.75;
		number_000.scaleY = 0.75;

		// number_111
		const number_111 = this.add.image(331, 1311, "number_111");
		number_111.scaleX = 0.75;
		number_111.scaleY = 0.75;

		// number_222
		const number_222 = this.add.image(526, 1311, "number_222");
		number_222.scaleX = 0.75;
		number_222.scaleY = 0.75;

		// number_333
		const number_333 = this.add.image(724, 1311, "number_333");
		number_333.scaleX = 0.75;
		number_333.scaleY = 0.75;

		// number_444
		const number_444 = this.add.image(922, 1311, "number_444");
		number_444.scaleX = 0.75;
		number_444.scaleY = 0.75;

		// number_555
		const number_555 = this.add.image(138, 1383, "number_555");
		number_555.scaleX = 0.75;
		number_555.scaleY = 0.75;

		// number_666
		const number_666 = this.add.image(331, 1383, "number_666");
		number_666.scaleX = 0.75;
		number_666.scaleY = 0.75;

		// number_777
		const number_777 = this.add.image(528, 1382, "number_777");
		number_777.scaleX = 0.75;
		number_777.scaleY = 0.75;

		// number_888
		const number_888 = this.add.image(725, 1383, "number_888");
		number_888.scaleX = 0.75;
		number_888.scaleY = 0.75;

		// number_999
		const number_999 = this.add.image(921, 1382, "number_999");
		number_999.scaleX = 0.75;
		number_999.scaleY = 0.75;

		// title_bigbox_purple
		const title_bigbox_purple = this.add.image(531, 1600, "title_bigbox_purple");
		title_bigbox_purple.scaleX = 0.75;
		title_bigbox_purple.scaleY = 0.75;

		// title_sum
		const title_sum = this.add.image(536, 1459, "title_sum");
		title_sum.scaleX = 0.75;
		title_sum.scaleY = 0.75;

		// number_sum_03
		const number_sum_03 = this.add.image(140, 1536, "number_sum_03");
		number_sum_03.scaleX = 0.75;
		number_sum_03.scaleY = 0.75;

		// number_sum_04
		const number_sum_04 = this.add.image(335, 1536, "number_sum_04");
		number_sum_04.scaleX = 0.75;
		number_sum_04.scaleY = 0.75;

		// number_sum_05
		const number_sum_05 = this.add.image(532, 1536, "number_sum_05");
		number_sum_05.scaleX = 0.75;
		number_sum_05.scaleY = 0.75;

		// number_sum_06
		const number_sum_06 = this.add.image(730, 1536, "number_sum_06");
		number_sum_06.scaleX = 0.75;
		number_sum_06.scaleY = 0.75;

		// number_sum_07
		const number_sum_07 = this.add.image(924, 1536, "number_sum_07");
		number_sum_07.scaleX = 0.75;
		number_sum_07.scaleY = 0.75;

		// number_sum_08
		const number_sum_08 = this.add.image(140, 1613, "number_sum_08");
		number_sum_08.scaleX = 0.75;
		number_sum_08.scaleY = 0.75;

		// number_sum_09
		const number_sum_09 = this.add.image(335, 1613, "number_sum_09");
		number_sum_09.scaleX = 0.75;
		number_sum_09.scaleY = 0.75;

		// number_sum_10
		const number_sum_10 = this.add.image(532, 1613, "number_sum_10");
		number_sum_10.scaleX = 0.75;
		number_sum_10.scaleY = 0.75;

		// number_sum_11
		const number_sum_11 = this.add.image(730, 1613, "number_sum_11");
		number_sum_11.scaleX = 0.75;
		number_sum_11.scaleY = 0.75;

		// number_sum_12
		const number_sum_12 = this.add.image(924, 1613, "number_sum_12");
		number_sum_12.scaleX = 0.75;
		number_sum_12.scaleY = 0.75;

		// number_sum_13
		const number_sum_13 = this.add.image(140, 1688, "number_sum_13");
		number_sum_13.scaleX = 0.75;
		number_sum_13.scaleY = 0.75;

		// number_sum_14
		const number_sum_14 = this.add.image(335, 1688, "number_sum_14");
		number_sum_14.scaleX = 0.75;
		number_sum_14.scaleY = 0.75;

		// number_sum_15
		const number_sum_15 = this.add.image(532, 1688, "number_sum_15");
		number_sum_15.scaleX = 0.75;
		number_sum_15.scaleY = 0.75;

		// number_sum_16
		const number_sum_16 = this.add.image(730, 1688, "number_sum_16");
		number_sum_16.scaleX = 0.75;
		number_sum_16.scaleY = 0.75;

		// number_sum_17
		const number_sum_17 = this.add.image(924, 1688, "number_sum_17");
		number_sum_17.scaleX = 0.75;
		number_sum_17.scaleY = 0.75;

		// number_sum_18
		const number_sum_18 = this.add.image(140, 1761, "number_sum_18");
		number_sum_18.scaleX = 0.75;
		number_sum_18.scaleY = 0.75;

		// number_sum_19
		const number_sum_19 = this.add.image(335, 1761, "number_sum_19");
		number_sum_19.scaleX = 0.75;
		number_sum_19.scaleY = 0.75;

		// number_sum_20
		const number_sum_20 = this.add.image(532, 1761, "number_sum_20");
		number_sum_20.scaleX = 0.75;
		number_sum_20.scaleY = 0.75;

		// number_sum_21
		const number_sum_21 = this.add.image(730, 1761, "number_sum_21");
		number_sum_21.scaleX = 0.75;
		number_sum_21.scaleY = 0.75;

		// number_sum_22
		const number_sum_22 = this.add.image(924, 1761, "number_sum_22");
		number_sum_22.scaleX = 0.75;
		number_sum_22.scaleY = 0.75;

		// number_sum_23
		const number_sum_23 = this.add.image(140, 1833, "number_sum_23");
		number_sum_23.scaleX = 0.75;
		number_sum_23.scaleY = 0.75;

		// number_sum_24
		const number_sum_24 = this.add.image(335, 1833, "number_sum_24");
		number_sum_24.scaleX = 0.75;
		number_sum_24.scaleY = 0.75;

		// number_sum_25
		const number_sum_25 = this.add.image(532, 1833, "number_sum_25");
		number_sum_25.scaleX = 0.75;
		number_sum_25.scaleY = 0.75;

		// number_sum_26
		const number_sum_26 = this.add.image(730, 1833, "number_sum_26");
		number_sum_26.scaleX = 0.75;
		number_sum_26.scaleY = 0.75;

		// number_sum_27
		const number_sum_27 = this.add.image(924, 1833, "number_sum_27");
		number_sum_27.scaleX = 0.75;
		number_sum_27.scaleY = 0.75;

		// title_bigbox_yellow_2
		const title_bigbox_yellow_2 = this.add.image(530, 2054, "title_bigbox_yellow");
		title_bigbox_yellow_2.scaleX = 0.75;
		title_bigbox_yellow_2.scaleY = 0.75;

		// title_on_single
		const title_on_single = this.add.image(531, 1909, "title_on_single");
		title_on_single.scaleX = 0.75;
		title_on_single.scaleY = 0.75;

		// number_0
		const number_0 = this.add.image(137, 1987, "number_0");
		number_0.scaleX = 0.75;
		number_0.scaleY = 0.75;

		// number_1
		const number_1 = this.add.image(333, 1987, "number_1");
		number_1.scaleX = 0.75;
		number_1.scaleY = 0.75;

		// number_2
		const number_2 = this.add.image(533, 1987, "number_2");
		number_2.scaleX = 0.75;
		number_2.scaleY = 0.75;

		// number_3
		const number_3 = this.add.image(729, 1987, "number_3");
		number_3.scaleX = 0.75;
		number_3.scaleY = 0.75;

		// number_4
		const number_4 = this.add.image(925, 1987, "number_4");
		number_4.scaleX = 0.75;
		number_4.scaleY = 0.75;

		// number_5
		const number_5 = this.add.image(137, 2060, "number_5");
		number_5.scaleX = 0.75;
		number_5.scaleY = 0.75;

		// number_6
		const number_6 = this.add.image(333, 2060, "number_6");
		number_6.scaleX = 0.75;
		number_6.scaleY = 0.75;

		// number_7
		const number_7 = this.add.image(533, 2060, "number_7");
		number_7.scaleX = 0.75;
		number_7.scaleY = 0.75;

		// number_8
		const number_8 = this.add.image(729, 2060, "number_8");
		number_8.scaleX = 0.75;
		number_8.scaleY = 0.75;

		// number_9
		const number_9 = this.add.image(925, 2060, "number_9");
		number_9.scaleX = 0.75;
		number_9.scaleY = 0.75;

		// token_bar_box
		const token_bar_box = this.add.image(534, 2219, "token_bar_box");
		token_bar_box.scaleX = 0.75;
		token_bar_box.scaleY = 0.75;

		// token_bar_clean
		const token_bar_clean = this.add.image(954, 2157, "token_bar_clean");
		token_bar_clean.scaleX = 0.75;
		token_bar_clean.scaleY = 0.75;

		// chip_10
		const chip_10 = this.add.image(234, 2224, "chip_10");
		chip_10.scaleX = 0.65;
		chip_10.scaleY = 0.65;

		// chip_100
		const chip_100 = this.add.image(334, 2224, "chip_100");
		chip_100.scaleX = 0.65;
		chip_100.scaleY = 0.65;

		// chip_150
		const chip_150 = this.add.image(434, 2224, "chip_150");
		chip_150.scaleX = 0.65;
		chip_150.scaleY = 0.65;

		// chip_200
		const chip_200 = this.add.image(534, 2224, "chip_200");
		chip_200.scaleX = 0.65;
		chip_200.scaleY = 0.65;

		// chip_300
		const chip_300 = this.add.image(634, 2224, "chip_300");
		chip_300.scaleX = 0.65;
		chip_300.scaleY = 0.65;

		// chip_50
		const chip_50 = this.add.image(734, 2224, "chip_50");
		chip_50.scaleX = 0.65;
		chip_50.scaleY = 0.65;

		// chip_500
		const chip_500 = this.add.image(834, 2224, "chip_500");
		chip_500.scaleX = 0.65;
		chip_500.scaleY = 0.65;

		// setting
		const setting = this.add.image(1022, 2262, "setting");
		setting.scaleX = 0.75;
		setting.scaleY = 0.75;

		// bg_light
		const bg_light = this.add.image(540, 973, "bg_light");
		bg_light.scaleX = 0.72;
		bg_light.scaleY = 0.72;

		// bg_line_right
		const bg_line_right = this.add.image(936, 115, "bg_line_right");
		bg_line_right.scaleX = 0.7;
		bg_line_right.scaleY = 0.7;

		// logo_combi3
		const logo_combi3 = this.add.image(539, 66, "logo_combi3");
		logo_combi3.scaleX = 0.7;
		logo_combi3.scaleY = 0.7;

		// bg_line_left
		const bg_line_left = this.add.image(141, 115, "bg_line_left");
		bg_line_left.scaleX = 0.7;
		bg_line_left.scaleY = 0.7;

		// _3N_box
		const _3N_box = this.add.image(420, 181, "3N_box");
		_3N_box.scaleX = 0.7;
		_3N_box.scaleY = 0.7;

		// _3N_box_1
		const _3N_box_1 = this.add.image(538, 181, "3N_box");
		_3N_box_1.scaleX = 0.7;
		_3N_box_1.scaleY = 0.7;

		// _3N_box_2
		const _3N_box_2 = this.add.image(655, 181, "3N_box");
		_3N_box_2.scaleX = 0.7;
		_3N_box_2.scaleY = 0.7;

		// time
		const time = this.add.image(274, 209, "time");
		time.scaleX = 0.7;
		time.scaleY = 0.7;

		// box_round
		const box_round = this.add.image(130, 199, "box_round");
		box_round.scaleX = 0.7;
		box_round.scaleY = 0.7;

		// box_amount
		const box_amount = this.add.image(894, 200, "box_amount");
		box_amount.scaleX = 0.7;
		box_amount.scaleY = 0.7;

		// odd_box_mid
		const odd_box_mid = this.add.image(543, 743, "odd_box_mid");
		odd_box_mid.scaleX = 0.7;
		odd_box_mid.scaleY = 0.7;

		// odd_box_left
		const odd_box_left = this.add.image(277, 742, "odd_box_left");
		odd_box_left.scaleX = 0.7;
		odd_box_left.scaleY = 0.7;

		// odd_box_right
		const odd_box_right = this.add.image(808, 742, "odd_box_right");
		odd_box_right.scaleX = 0.7;
		odd_box_right.scaleY = 0.7;

		// 1:1 LOSE IF ANY TRIPLE
		const _1_1_LOSE_IF_ANY_TRIPLE = this.add.text(144, 733, "", {});
		_1_1_LOSE_IF_ANY_TRIPLE.scaleX = 1.3;
		_1_1_LOSE_IF_ANY_TRIPLE.scaleY = 1.3;
		_1_1_LOSE_IF_ANY_TRIPLE.text = "1:1 LOSE IF ANY TRIPLE";
		_1_1_LOSE_IF_ANY_TRIPLE.setStyle({  });

		// 1:1 LOSE IF ANY TRIPLE_1
		const _1_1_LOSE_IF_ANY_TRIPLE_1 = this.add.text(664, 733, "", {});
		_1_1_LOSE_IF_ANY_TRIPLE_1.scaleX = 1.3;
		_1_1_LOSE_IF_ANY_TRIPLE_1.scaleY = 1.3;
		_1_1_LOSE_IF_ANY_TRIPLE_1.text = "1:1 LOSE IF ANY TRIPLE";
		_1_1_LOSE_IF_ANY_TRIPLE_1.setStyle({  });

		// 1:1 LOSE IF ANY TRIPLE_2
		const _1_1_LOSE_IF_ANY_TRIPLE_2 = this.add.text(520, 733, "", {});
		_1_1_LOSE_IF_ANY_TRIPLE_2.scaleX = 1.3;
		_1_1_LOSE_IF_ANY_TRIPLE_2.scaleY = 1.3;
		_1_1_LOSE_IF_ANY_TRIPLE_2.text = "30:1";
		_1_1_LOSE_IF_ANY_TRIPLE_2.setStyle({  });

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
