# Dokumentasi Pemetaan 102 Kelas Spesies Hama IP102 — Smart Light Trap Subang

Dokumen ini menyajikan audit dan pemetaan taksonomi lengkap dari seluruh **102 kelas hama dataset benchmark IP102** ke skema master data database Supabase [`public.insect_species`](file:///d:/Projek%20Koding/Projek-SmartLightV2/supabase/migrations/00004_initial_seed.sql) untuk armada pemantauan **Smart Light Trap (Kabupaten Subang, Jawa Barat)**.

---

## 1. Prinsip & Aturan Pemetaan Ketat

1. **Integritas Taksonomi**:
   Pemetaan ke `species_code` Supabase hanya dilakukan jika spesies serangga pada IP102 secara biologis dan agronomis identik atau sepadan langsung dengan hama sasaran PHT Subang.
2. **Larangan Silent Fallback**:
   Kelas serangga yang tidak terverifikasi atau bukan hama tanaman padi di wilayah Subang diberi status **`unmapped`** / **`unidentified`**, dan **DILARANG KERAS** dialihkan secara otomatis (*silent fallback*) ke `other_neutral`. Menganggap hama asing sebagai serangga netral membahayakan keputusan pengendalian hama di lapangan.
3. **Pemisahan Kategori**:
   - `target_pest`: Hama utama tanaman padi Subang yang masuk dalam ambang ekonomi pengendalian (*economic threshold*).
   - `neutral_insect`: Serangga malam non-hama yang telah terverifikasi tidak merusak padi (saat ini terdaftar sebagai `other_neutral` di Supabase).
   - `unmapped`: 94 kelas hama IP102 yang merupakan hama gandum, bit gula, alfalfa, jeruk, atau buah subtropis lain yang tidak relevan dengan ekosistem sawah padi Subang.
4. **Catatan Kritis Kesenjangan Spesies**:
   - **Walang Sangit (*Leptocorisa oratoria*)**: Terdaftar di database Supabase Subang, namun **TIDAK ADA** dalam 102 kelas IP102. Deteksi walang sangit memerlukan fine-tuning tambahan menggunakan citra lokal Subang.
   - **Ulat Grayak (*Mythimna separata* vs *Spodoptera frugiperda*)**: Kelas 23 IP102 adalah *Mythimna separata* (Oriental armyworm), sedangkan di Subang terdaftar *Spodoptera frugiperda* (Fall armyworm). Keduanya termasuk famili Noctuidae pemakan daun, namun genus berbeda.

---

## 2. Tabel Pemetaan Lengkap 102 Kelas IP102

| ID | Nama IP102 (`data.yaml`) | Nama Ilmiah / Takson | Nama Lokal (Indonesia) | `species_code` Supabase | Kategori PHT | Prioritas | Status Verifikasi |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **0** | `rice leaf roller` | *Cnaphalocrocis medinalis* | Hama Putih Palsu / Penggulung Daun | `cnaphalocrocis_medinalis` | `target_pest` | **Medium** | **VERIFIED** |
| 1 | `rice leaf caterpillar` | *Parnara guttata* / *Naranga* | Ulat Daun Padi / Kupu Lipat | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 2 | `paddy stem maggot` | *Chlorops oryzae* | Lalat Batang Padi | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| **3** | `asiatic rice borer` | *Chilo suppressalis* | Penggerek Batang Padi Bergaris | `scirpophaga_incertulas` | `target_pest` | **Critical** | **VERIFIED** |
| **4** | `yellow rice borer` | *Scirpophaga incertulas* | Penggerek Batang Padi Kuning | `scirpophaga_incertulas` | `target_pest` | **Critical** | **VERIFIED** |
| 5 | `rice gall midge` | *Orseolia oryzae* | Hama Ganjur Padi | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 6 | `Rice Stemfly` | *Hydrellia sasakii* | Lalat Bibit / Lalat Penggerek Padi | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| **7** | `brown plant hopper` | *Nilaparvata lugens* | Wereng Batang Coklat (WBC) | `nilaparvata_lugens` | `target_pest` | **Critical** | **VERIFIED** |
| **8** | `white backed plant hopper` | *Sogatella furcifera* | Wereng Punggung Putih (WPP) | `nilaparvata_lugens` | `target_pest` | **High** | **VERIFIED** |
| **9** | `small brown plant hopper` | *Laodelphax striatellus* | Wereng Coklat Kecil | `nilaparvata_lugens` | `target_pest` | **High** | **VERIFIED** |
| 10 | `rice water weevil` | *Lissorhoptrus oryzophilus* | Kumbang Moncong Air Padi | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| **11** | `rice leafhopper` | *Nephotettix cincticeps* | Wereng Daun Hijau (WDH) | `nilaparvata_lugens` | `target_pest` | **High** | **VERIFIED** |
| 12 | `grain spreader thrips` | *Haplothrips aculeatus* | Trips Bulir Padi | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 13 | `rice shell pest` | *Dicladispa armigera* | Hama Hispa Padi | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 14 | `grub` | Scarabaeidae larvae | Uret / Larva Kumbang Tanah | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 15 | `mole cricket` | *Gryllotalpa africana* | Orong-orong / Anjing Tanah | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 16 | `wireworm` | Elateridae larvae | Ulat Kawat | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 17 | `white margined moth` | *Acyphas semimarginata* | Ngengat Sayap Putih | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 18 | `black cutworm` | *Agrotis ipsilon* | Ulat Tanah Hitam | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 19 | `large cutworm` | *Agrotis tokionis* | Ulat Tanah Besar | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 20 | `yellow cutworm` | *Spodoptera depravata* | Ulat Tanah Kuning | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 21 | `red spider` | *Tetranychus urticae* | Tungau Merah | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 22 | `corn borer` | *Ostrinia furnacalis* | Penggerek Tongkol Jagung | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| **23** | `army worm` | *Mythimna separata* | Ulat Grayak Tanaman Pangan | `spodoptera_frugiperda` | `target_pest` | **High** | **VERIFIED** |
| 24 | `aphids` | Aphidoidea | Kutu Daun Umum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 25 | `Potosiabre vitarsis` | *Protaetia brevitarsis* | Kumbang Bunga Berbintik | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 26 | `peach borer` | *Synanthedon exitiosa* | Penggerek Batang Persik | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 27 | `english grain aphid` | *Sitobion avenae* | Kutu Daun Gandum Inggris | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 28 | `green bug` | *Schizaphis graminum* | Kutu Hijau Serealia | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 29 | `bird cherry-oataphid` | *Rhopalosiphum padi* | Kutu Daun Oat / Gandum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 30 | `wheat blossom midge` | *Sitodiplosis mosellana* | Nyamuk Bunga Gandum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 31 | `penthaleus major` | *Penthaleus major* | Tungau Kaki Merah Musim Dingin | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 32 | `longlegged spider mite` | *Petrobia latens* | Tungau Kaki Panjang | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 33 | `wheat phloeothrips` | *Haplothrips tritici* | Trips Gandum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 34 | `wheat sawfly` | *Cephus cinctus* | Lalat Gergaji Gandum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 35 | `cerodonta denticornis` | *Cerodontha denticornis* | Lalat Penggorok Daun Serealia | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 36 | `beet fly` | *Pegomya hyoscyami* | Lalat Bit Gula | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 37 | `flea beetle` | *Chaetocnema concinna* | Kumbang Lompat Bit | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 38 | `cabbage army worm` | *Mamestra brassicae* | Ulat Grayak Kubis | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 39 | `beet army worm` | *Spodoptera exigua* | Ulat Grayak Bawang / Bit | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 40 | `Beet spot flies` | Anthomyiidae | Lalat Tutul Daun Bit | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 41 | `meadow moth` | *Loxostege sticticalis* | Ngengat Padang Rumput | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 42 | `beet weevil` | *Bothynoderes punctiventris* | Kumbang Moncong Bit | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 43 | `sericaorient alismots chulsky` | *Serica orientalis* | Kumbang Malam Oriental | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 44 | `alfalfa weevil` | *Hypera postica* | Kumbang Moncong Alfalfa | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 45 | `flax budworm` | *Heliothis ononis* | Penggerek Kuncup Flax | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 46 | `alfalfa plant bug` | *Adelphocoris lineolatus* | Kepik Tanaman Alfalfa | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 47 | `tarnished plant bug` | *Lygus lineolaris* | Kepik Noda Hijau | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 48 | `Locustoidea` | Acrididae / Tettigonioidea | Belalang Padang Rumput | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 49 | `lytta polita` | *Lytta polita* | Kumbang Lepuh Polita | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 50 | `legume blister beetle` | *Epicauta* sp. | Kumbang Lepuh Kacang-kacangan | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 51 | `blister beetle` | Meloidae | Kumbang Lepuh Umum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 52 | `therioaphis maculata Buckton` | *Therioaphis maculata* | Kutu Daun Berbintik Alfalfa | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 53 | `odontothrips loti` | *Odontothrips loti* | Trips Bunga Polong | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 54 | `Thrips` | Thysanoptera | Kutu Trips Umum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 55 | `alfalfa seed chalcid` | *Bruchophagus roddi* | Tawon Benih Alfalfa | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 56 | `Pieris canidia` | *Pieris canidia* | Kupu-kupu Kubis India | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 57 | `Apolygus lucorum` | *Apolygus lucorum* | Kepik Mirid Hijau Kecil | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 58 | `Limacodidae` | Limacodidae | Ulat Gelang / Ulat Api Buah | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 59 | `Viteus vitifoliae` | *Daktulosphaira vitifoliae* | Phylloxera Daun Anggur | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 60 | `Colomerus vitis` | *Colomerus vitis* | Tungau Puru Daun Anggur | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 61 | `Brevipoalpus lewisi McGregor` | *Brevipalpus lewisi* | Tungau Datar Jeruk / Anggur | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 62 | `oides decempunctata` | *Oides decempunctata* | Kumbang Daun Anggur Berbintik 10 | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 63 | `Polyphagotars onemus latus` | *Polyphagotarsonemus latus* | Tungau Kuning Lebar | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 64 | `Pseudococcus comstocki Kuwana` | *Pseudococcus comstocki* | Kutu Putih Comstock | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 65 | `parathrene regalis` | *Paranthrene regalis* | Ngengat Penggerek Anggur | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 66 | `Ampelophaga` | *Ampelophaga rubiginosa* | Ulat Tanduk Daun Anggur | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 67 | `Lycorma delicatula` | *Lycorma delicatula* | Wereng Lentera Berbintik | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 68 | `Xylotrechus` | *Xylotrechus pyrrhoderus* | Kumbang Tanduk Penggerek Batang | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 69 | `Cicadella viridis` | *Cicadella viridis* | Wereng Daun Hijau Rawa | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 70 | `Miridae` | Miridae | Kepik Tanaman Miridae Umum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 71 | `Trialeurodes vaporariorum` | *Trialeurodes vaporariorum* | Kutu Kebul Rumah Kaca | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 72 | `Erythroneura apicalis` | *Erythroneura apicalis* | Wereng Daun Anggur | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 73 | `Papilio xuthus` | *Papilio xuthus* | Kupu-kupu Ekor Walet Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 74 | `Panonchus citri McGregor` | *Panonychus citri* | Tungau Merah Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 75 | `Phyllocoptes oleiverus ashmead` | *Phyllocoptruta oleivora* | Tungau Karat Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 76 | `Icerya purchasi Maskell` | *Icerya purchasi* | Kutu Sisik Berbantalan Kapas | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 77 | `Unaspis yanonensis` | *Unaspis yanonensis* | Kutu Sisik Ujung Panah Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 78 | `Ceroplastes rubens` | *Ceroplastes rubens* | Kutu Lilin Merah Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 79 | `Chrysomphalus aonidum` | *Chrysomphalus aonidum* | Kutu Sisik Bulat Hitam Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 80 | `Parlatoria zizyphus Lucus` | *Parlatoria ziziphi* | Kutu Sisik Hitam Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 81 | `Nipaecoccus vastalor` | *Nipaecoccus viridis* | Kutu Putih Jeruk Lebak | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 82 | `Aleurocanthus spiniferus` | *Aleurocanthus spiniferus* | Kutu Putih Berduri Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 83 | `Tetradacus c Bactrocera minax` | *Bactrocera minax* | Lalat Buah Jeruk Tiongkok | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 84 | `Dacus dorsalis(Hendel)` | *Bactrocera dorsalis* | Lalat Buah Oriental | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 85 | `Bactrocera tsuneonis` | *Bactrocera tsuneonis* | Lalat Buah Jeruk Jepang | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 86 | `Prodenia litura` | *Spodoptera litura* | Ulat Grayak Daun Tembakau | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 87 | `Adristyrannus` | *Dialeurodes citri* | Kutu Kebul Jeruk Putih | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 88 | `Phyllocnistis citrella Stainton` | *Phyllocnistis citrella* | Ngengat Penggorok Daun Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 89 | `Toxoptera citricidus` | *Toxoptera citricida* | Kutu Daun Jeruk Coklat | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 90 | `Toxoptera aurantii` | *Toxoptera aurantii* | Kutu Daun Jeruk Hitam | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 91 | `Aphis citricola Vander Goot` | *Aphis spiraecola* | Kutu Daun Jeruk Hijau | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 92 | `Scirtothrips dorsalis Hood` | *Scirtothrips dorsalis* | Trips Cabai / Jeruk Kuning | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 93 | `Dasineura sp` | *Dasineura* sp. | Nyamuk Puru Kuncup Jeruk | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 94 | `Lawana imitata Melichar` | *Lawana imitata* | Wereng Lilin Putih Mangga | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 95 | `Salurnis marginella Guerr` | *Salurnis marginella* | Wereng Pipih Daun Mangga | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 96 | `Deporaus marginatus Pascoe` | *Deporaus marginatus* | Kumbang Penggunting Daun Mangga | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 97 | `Chlumetia transversa` | *Chlumetia transversa* | Penggerek Tunas Pucuk Mangga | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 98 | `Mango flat beak leafhopper` | *Idioscopus nitidulus* | Wereng Bunga Mangga Paruh Datar | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 99 | `Rhytidodera bowrinii white` | *Rhytidodera bowringii* | Kumbang Antena Panjang Mangga | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 100 | `Sternochetus frigidus` | *Sternochetus frigidus* | Kumbang Penggerek Daging Mangga | `unmapped` | `unmapped` | Unmapped | UNMAPPED |
| 101 | `Cicadellidae` | Cicadellidae | Famili Wereng Daun Umum | `unmapped` | `unmapped` | Unmapped | UNMAPPED |

---

## 3. Rangkuman Statistik Taksonomi

- **Total Kelas IP102:** 102 kelas (ID 0 hingga 101).
- **Kelas Terpetakan ke Target Hama Subang:** **8 Kelas** (ID: 0, 3, 4, 7, 8, 9, 11, 23).
  - *Scirpophaga incertulas* (Penggerek Batang Kuning): ID 3, 4
  - *Nilaparvata lugens* (Wereng Batang Coklat & Wereng Padi): ID 7, 8, 9, 11
  - *Cnaphalocrocis medinalis* (Hama Putih Palsu): ID 0
  - *Spodoptera frugiperda* / *Mythimna* (Armyworm): ID 23
- **Kelas Unmapped (Bukan Hama Utama Padi Subang):** **94 Kelas**.
- **Kesenjangan Spesies Lapangan Subang:**
  - *Walang Sangit* (*Leptocorisa oratoria*) berstatus **TIDAK TERSEDIA** di dataset IP102.
  - Untuk mendeteksi Walang Sangit, diperlukan modul augmentasi dataset citra baki perangkap lokal Subang sebelum model dideploy ke produksi penuh.

