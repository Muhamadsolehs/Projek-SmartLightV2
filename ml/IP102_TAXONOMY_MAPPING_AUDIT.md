# Audit Taksonomi Pemetaan Hama IP102 vs Database Supabase Smart Light Trap Subang

**Dokumen Audit Taksonomi PHT & Computer Vision**  
**Tanggal Audit:** 9 November 2026  
**Status Audit:** **AUDITED (Kesenjangan Taksonomi Teridentifikasi)**  

---

## 1. Temuan Utama Audit Taksonomi

1. **Pencocokan Tepat (Exact Biological Match): Hanya 3 Spesies**
   - **Class 4** yellow rice borer -> *Scirpophaga incertulas* (Penggerek Batang Padi Kuning).
   - **Class 7** rown plant hopper -> *Nilaparvata lugens* (Wereng Batang Coklat / WBC).
   - **Class 0** 
ice leaf roller -> *Cnaphalocrocis medinalis* (Hama Putih Palsu / Penggulung Daun).

2. **Kesenjangan Kritis Walang Sangit (*Leptocorisa oratoria*)**
   - Di database Supabase Subang, *Leptocorisa oratoria* (Walang Sangit) adalah hama target prioritas (
isk_level: medium, economic_threshold: 40).
   - **HASIL AUDIT:** Dalam seluruh 102 kelas IP102, **TIDAK DITEMUKAN spesies Walang Sangit (*Leptocorisa oratoria*)**.
   - **KOREKSI TEMUAN SEBELUMNYA:** Class 15 IP102 adalah mole cricket (Orong-orong / *Gryllotalpa*), **BUKAN** Walang Sangit! Memetakan Class 15 ke leptocorisa_oratoria adalah kesalahan fatal yang telah dikoreksi.

3. **Pencocokan Taksonomi Mendekati (Needs Review): 5 Spesies**
   - **Class 3** siatic rice borer (*Chilo suppressalis*) dipetakan ke scirpophaga_incertulas. Keduanya adalah penggerek batang padi, tetapi genus berbeda (*Chilo* vs *Scirpophaga*).
   - **Class 8 & 9** white backed plant hopper (*Sogatella furcifera*) dan small brown plant hopper (*Laodelphax striatellus*) dipetakan ke 
ilaparvata_lugens. Ketiganya sama-sama wereng Delphacidae pengisap batang padi, namun spesies berbeda.
   - **Class 11** 
ice leafhopper (*Nephotettix cincticeps* - Wereng Daun Hijau) dipetakan ke 
ilaparvata_lugens. Secara biologi berbeda famili (*Cicadellidae* vs *Delphacidae*). Direkomendasikan menambah species_code: 'nephotettix_cincticeps' pada Supabase DB di masa mendatang.
   - **Class 23** rmy worm (*Mythimna separata*) dipetakan ke spodoptera_frugiperda. Keduanya adalah ulat grayak pemakan daun dalam famili *Noctuidae*, namun berbeda genus.

4. **Status Unmapped (94 Kelas):**
   - 94 kelas lainnya adalah hama gandum, bit gula, kapas, buah jeruk, atau mangga subtropis yang tidak ada di persawahan Subang.
   - Sesuai aturan audit, seluruh 94 kelas ini berstatus **unmapped** dan **TIDAK BOLEH** secara otomatis dikelompokkan ke other_neutral.

---

## 2. Tabel Lengkap Audit 102 Kelas IP102

| IP102 Class ID | Nama Asli IP102 (classes.txt) | Species ID Supabase | Nama Spesies Lokal / Ilmiah | Kategori PHT | Keyakinan | Status | Catatan Teknis Taksonomi |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **0** | rice leaf roller | cnaphalocrocis_medinalis | Hama Putih Palsu / Penggulung Daun | target_pest | High | **verified** | Cnaphalocrocis medinalis (pencocokan spesies tepat) |
| **1** | rice leaf caterpillar | unmapped | Ulat Daun Padi (Parnara guttata) | unmapped | None | **unmapped** | Bukan target utama PHT Subang saat ini |
| **2** | paddy stem maggot | unmapped | Lalat Batang Padi (Chlorops oryzae) | unmapped | None | **unmapped** | Hama lalat subtropis, tidak terdaftar di DB Subang |
| **3** | asiatic rice borer | scirpophaga_incertulas | Penggerek Batang Padi Bergaris (Chilo) | target_pest | Medium | **needs_review** | Chilo suppressalis (genus berbeda dengan Scirpophaga incertulas) |
| **4** | yellow rice borer | scirpophaga_incertulas | Penggerek Batang Padi Kuning | target_pest | High | **verified** | Scirpophaga incertulas (pencocokan spesies tepat) |
| **5** | rice gall midge | unmapped | Hama Ganjur Padi (Orseolia oryzae) | unmapped | None | **unmapped** | Belum ada ID taksonomi khusus di Supabase DB |
| **6** | Rice Stemfly | unmapped | Lalat Bibit Padi (Hydrellia sasakii) | unmapped | None | **unmapped** | Belum ada ID taksonomi khusus di Supabase DB |
| **7** | brown plant hopper | nilaparvata_lugens | Wereng Batang Coklat (WBC) | target_pest | High | **verified** | Nilaparvata lugens (pencocokan spesies tepat) |
| **8** | white backed plant hopper | nilaparvata_lugens | Wereng Punggung Putih (WPP) | target_pest | Medium | **needs_review** | Sogatella furcifera (genus berbeda, Delphacidae) |
| **9** | small brown plant hopper | nilaparvata_lugens | Wereng Coklat Kecil | target_pest | Medium | **needs_review** | Laodelphax striatellus (genus berbeda, Delphacidae) |
| **10** | rice water weevil | unmapped | Kumbang Moncong Air Padi | unmapped | None | **unmapped** | Lissorhoptrus oryzophilus, tidak terdaftar di DB Subang |
| **11** | rice leafhopper | nilaparvata_lugens | Wereng Daun Hijau (WDH) | target_pest | Low | **needs_review** | Nephotettix cincticeps (famili Cicadellidae, beda ordo dengan WBC Delphacidae) |
| **12** | grain spreader thrips | unmapped | Trips Bulir Padi (Haplothrips aculeatus) | unmapped | None | **unmapped** | Belum ada ID taksonomi khusus di Supabase DB |
| **13** | rice shell pest | unmapped | Hama Hispa Padi (Dicladispa armigera) | unmapped | None | **unmapped** | Belum ada ID taksonomi khusus di Supabase DB |
| **14** | grub | unmapped | Uret / Larva Kumbang Tanah (Scarabaeidae) | unmapped | None | **unmapped** | Hama tanah umum, belum terdaftar di DB Subang |
| **15** | mole cricket | unmapped | Orong-orong / Anjing Tanah (Gryllotalpa) | unmapped | None | **unmapped** | Bukan Walang Sangit! Mole cricket = Orong-orong |
| **16** | wireworm | unmapped | Ulat Kawat (Elateridae) | unmapped | None | **unmapped** | Hama tanah umum, belum terdaftar di DB Subang |
| **17** | white margined moth | unmapped | Ngengat Sayap Putih (Acyphas semimarginata) | unmapped | None | **unmapped** | Bukan hama sasaran padi Subang |
| **18** | black cutworm | unmapped | Ulat Tanah Hitam (Agrotis ipsilon) | unmapped | None | **unmapped** | Hama sayuran/jagung, belum terdaftar di DB Subang |
| **19** | large cutworm | unmapped | Ulat Tanah Besar (Agrotis tokionis) | unmapped | None | **unmapped** | Bukan hama sasaran padi Subang |
| **20** | yellow cutworm | unmapped | Ulat Tanah Kuning (Spodoptera depravata) | unmapped | None | **unmapped** | Bukan target utama PHT Subang |
| **21** | red spider | unmapped | Tungau Merah (Tetranychus urticae) | unmapped | None | **unmapped** | Hama sayur/buah, bukan hama target baki perangkap |
| **22** | corn borer | unmapped | Penggerek Tongkol Jagung (Ostrinia) | unmapped | None | **unmapped** | Hama jagung, bukan padi |
| **23** | army worm | spodoptera_frugiperda | Ulat Grayak Tanaman Pangan (Mythimna) | target_pest | Medium | **needs_review** | Mythimna separata (IP102) vs Spodoptera frugiperda (Subang DB) |
| **24** | aphids | unmapped | Unmapped Non-Paddy (aphids) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **25** | Potosiabre vitarsis | unmapped | Unmapped Non-Paddy (Potosiabre vitarsis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **26** | peach borer | unmapped | Unmapped Non-Paddy (peach borer) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **27** | english grain aphid | unmapped | Unmapped Non-Paddy (english grain aphid) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **28** | green bug | unmapped | Unmapped Non-Paddy (green bug) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **29** | bird cherry-oataphid | unmapped | Unmapped Non-Paddy (bird cherry-oataphid) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **30** | wheat blossom midge | unmapped | Unmapped Non-Paddy (wheat blossom midge) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **31** | penthaleus major | unmapped | Unmapped Non-Paddy (penthaleus major) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **32** | longlegged spider mite | unmapped | Unmapped Non-Paddy (longlegged spider mite) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **33** | wheat phloeothrips | unmapped | Unmapped Non-Paddy (wheat phloeothrips) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **34** | wheat sawfly | unmapped | Unmapped Non-Paddy (wheat sawfly) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **35** | cerodonta denticornis | unmapped | Unmapped Non-Paddy (cerodonta denticornis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **36** | beet fly | unmapped | Unmapped Non-Paddy (beet fly) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **37** | flea beetle | unmapped | Unmapped Non-Paddy (flea beetle) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **38** | cabbage army worm | unmapped | Unmapped Non-Paddy (cabbage army worm) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **39** | beet army worm | unmapped | Unmapped Non-Paddy (beet army worm) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **40** | Beet spot flies | unmapped | Unmapped Non-Paddy (Beet spot flies) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **41** | meadow moth | unmapped | Unmapped Non-Paddy (meadow moth) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **42** | beet weevil | unmapped | Unmapped Non-Paddy (beet weevil) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **43** | sericaorient alismots chulsky | unmapped | Unmapped Non-Paddy (sericaorient alismots chulsky) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **44** | alfalfa weevil | unmapped | Unmapped Non-Paddy (alfalfa weevil) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **45** | flax budworm | unmapped | Unmapped Non-Paddy (flax budworm) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **46** | alfalfa plant bug | unmapped | Unmapped Non-Paddy (alfalfa plant bug) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **47** | tarnished plant bug | unmapped | Unmapped Non-Paddy (tarnished plant bug) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **48** | Locustoidea | unmapped | Unmapped Non-Paddy (Locustoidea) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **49** | lytta polita | unmapped | Unmapped Non-Paddy (lytta polita) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **50** | legume blister beetle | unmapped | Unmapped Non-Paddy (legume blister beetle) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **51** | blister beetle | unmapped | Unmapped Non-Paddy (blister beetle) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **52** | therioaphis maculata Buckton | unmapped | Unmapped Non-Paddy (therioaphis maculata Buckton) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **53** | odontothrips loti | unmapped | Unmapped Non-Paddy (odontothrips loti) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **54** | Thrips | unmapped | Unmapped Non-Paddy (Thrips) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **55** | alfalfa seed chalcid | unmapped | Unmapped Non-Paddy (alfalfa seed chalcid) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **56** | Pieris canidia | unmapped | Unmapped Non-Paddy (Pieris canidia) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **57** | Apolygus lucorum | unmapped | Unmapped Non-Paddy (Apolygus lucorum) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **58** | Limacodidae | unmapped | Unmapped Non-Paddy (Limacodidae) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **59** | Viteus vitifoliae | unmapped | Unmapped Non-Paddy (Viteus vitifoliae) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **60** | Colomerus vitis | unmapped | Unmapped Non-Paddy (Colomerus vitis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **61** | Brevipoalpus lewisi McGregor | unmapped | Unmapped Non-Paddy (Brevipoalpus lewisi McGregor) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **62** | oides decempunctata | unmapped | Unmapped Non-Paddy (oides decempunctata) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **63** | Polyphagotars onemus latus | unmapped | Unmapped Non-Paddy (Polyphagotars onemus latus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **64** | Pseudococcus comstocki Kuwana | unmapped | Unmapped Non-Paddy (Pseudococcus comstocki Kuwana) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **65** | parathrene regalis | unmapped | Unmapped Non-Paddy (parathrene regalis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **66** | Ampelophaga | unmapped | Unmapped Non-Paddy (Ampelophaga) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **67** | Lycorma delicatula | unmapped | Unmapped Non-Paddy (Lycorma delicatula) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **68** | Xylotrechus | unmapped | Unmapped Non-Paddy (Xylotrechus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **69** | Cicadella viridis | unmapped | Unmapped Non-Paddy (Cicadella viridis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **70** | Miridae | unmapped | Unmapped Non-Paddy (Miridae) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **71** | Trialeurodes vaporariorum | unmapped | Unmapped Non-Paddy (Trialeurodes vaporariorum) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **72** | Erythroneura apicalis | unmapped | Unmapped Non-Paddy (Erythroneura apicalis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **73** | Papilio xuthus | unmapped | Unmapped Non-Paddy (Papilio xuthus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **74** | Panonchus citri McGregor | unmapped | Unmapped Non-Paddy (Panonchus citri McGregor) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **75** | Phyllocoptes oleiverus ashmead | unmapped | Unmapped Non-Paddy (Phyllocoptes oleiverus ashmead) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **76** | Icerya purchasi Maskell | unmapped | Unmapped Non-Paddy (Icerya purchasi Maskell) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **77** | Unaspis yanonensis | unmapped | Unmapped Non-Paddy (Unaspis yanonensis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **78** | Ceroplastes rubens | unmapped | Unmapped Non-Paddy (Ceroplastes rubens) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **79** | Chrysomphalus aonidum | unmapped | Unmapped Non-Paddy (Chrysomphalus aonidum) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **80** | Parlatoria zizyphus Lucus | unmapped | Unmapped Non-Paddy (Parlatoria zizyphus Lucus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **81** | Nipaecoccus vastalor | unmapped | Unmapped Non-Paddy (Nipaecoccus vastalor) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **82** | Aleurocanthus spiniferus | unmapped | Unmapped Non-Paddy (Aleurocanthus spiniferus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **83** | Tetradacus c Bactrocera minax | unmapped | Unmapped Non-Paddy (Tetradacus c Bactrocera minax) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **84** | Dacus dorsalis(Hendel) | unmapped | Unmapped Non-Paddy (Dacus dorsalis(Hendel)) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **85** | Bactrocera tsuneonis | unmapped | Unmapped Non-Paddy (Bactrocera tsuneonis) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **86** | Prodenia litura | unmapped | Unmapped Non-Paddy (Prodenia litura) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **87** | Adristyrannus | unmapped | Unmapped Non-Paddy (Adristyrannus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **88** | Phyllocnistis citrella Stainton | unmapped | Unmapped Non-Paddy (Phyllocnistis citrella Stainton) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **89** | Toxoptera citricidus | unmapped | Unmapped Non-Paddy (Toxoptera citricidus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **90** | Toxoptera aurantii | unmapped | Unmapped Non-Paddy (Toxoptera aurantii) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **91** | Aphis citricola Vander Goot | unmapped | Unmapped Non-Paddy (Aphis citricola Vander Goot) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **92** | Scirtothrips dorsalis Hood | unmapped | Unmapped Non-Paddy (Scirtothrips dorsalis Hood) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **93** | Dasineura sp | unmapped | Unmapped Non-Paddy (Dasineura sp) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **94** | Lawana imitata Melichar | unmapped | Unmapped Non-Paddy (Lawana imitata Melichar) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **95** | Salurnis marginella Guerr | unmapped | Unmapped Non-Paddy (Salurnis marginella Guerr) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **96** | Deporaus marginatus Pascoe | unmapped | Unmapped Non-Paddy (Deporaus marginatus Pascoe) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **97** | Chlumetia transversa | unmapped | Unmapped Non-Paddy (Chlumetia transversa) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **98** | Mango flat beak leafhopper | unmapped | Unmapped Non-Paddy (Mango flat beak leafhopper) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **99** | Rhytidodera bowrinii white | unmapped | Unmapped Non-Paddy (Rhytidodera bowrinii white) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **100** | Sternochetus frigidus | unmapped | Unmapped Non-Paddy (Sternochetus frigidus) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
| **101** | Cicadellidae | unmapped | Unmapped Non-Paddy (Cicadellidae) | unmapped | None | **unmapped** | Bukan hama tanaman padi sawah Subang |
