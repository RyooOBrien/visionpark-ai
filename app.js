const SUPABASE_URL = "https://okqwqbsbgxxnzardfikl.supabase.co";
const SUPABASE_KEY = "sb_publishable_wOLLfPLqM3g53LakuzXyQQ_CnML5KCW";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const video = document.getElementById("video");
const platNomor = document.getElementById("platNomor");

function showAlert(title, message) {
  document.getElementById("alertTitle").innerText = title;
  document.getElementById("alertMessage").innerText = message;
  document.getElementById("customAlert").style.display = "flex";
}

function closeAlert() {
  document.getElementById("customAlert").style.display = "none";
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    video.srcObject = stream;
  } catch (error) {
    showAlert("Kamera Gagal", "Kamera gagal dibuka. Izinkan akses kamera terlebih dahulu.");
    console.log(error);
  }
}

startCamera();

async function scanPlatDariKamera() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const hasil = await Tesseract.recognize(canvas, "eng", {
    logger: m => console.log(m)
  });

  let teks = hasil.data.text.toUpperCase();

  teks = teks
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  console.log("Hasil OCR asli:", teks);

  // Gabungkan semua supaya B 1234 ABC / B1234ABC tetap bisa kebaca
  let clean = teks.replace(/\s+/g, "");

  // Perbaikan OCR umum
  clean = clean
    .replace(/^8/, "B")
    .replace(/^6/, "B")
    .replace(/O/g, "0")
    .replace(/I/g, "1");

  console.log("Hasil OCR clean:", clean);

  const cocok = clean.match(/(B|F)\d{1,4}[A-Z]{1,3}/);

  if (!cocok) {
    return null;
  }

  let platRaw = cocok[0];

  const pecah = platRaw.match(/^(B|F)(\d{1,4})([A-Z]{1,3})$/);

  if (!pecah) {
    return null;
  }

  const plat = `${pecah[1]} ${pecah[2]} ${pecah[3]}`;

  return plat;
}

document.getElementById("masukBtn").addEventListener("click", async () => {
  showAlert("Memindai Plat", "Sedang membaca plat nomor, tunggu sebentar...");

  const plat = await scanPlatDariKamera();

  if (!plat) {
    showAlert("Scan Gagal", "Sistem tidak dapat mengenali plat nomor. Pastikan pencahayaan cukup dan kamera fokus.");
    return;
  }

  platNomor.innerText = plat;

  const { error } = await supabaseClient
    .from("kendaraan")
    .insert([
      {
        plat_nomor: plat,
        status: "parkir"
      }
    ]);

  if (error) {
    showAlert("Gagal Simpan", "Data kendaraan masuk gagal disimpan.");
    console.log(error);
    return;
  }

  showAlert("Berhasil", "Kendaraan masuk berhasil disimpan: " + plat);
});

document.getElementById("keluarBtn").addEventListener("click", async () => {
  showAlert("Memindai Plat", "Sedang membaca plat nomor, tunggu sebentar...");

  const plat = await scanPlatDariKamera();

  if (!plat) {
    showAlert("Scan Gagal", "Sistem tidak dapat mengenali plat nomor. Pastikan pencahayaan cukup dan kamera fokus.");
    return;
  }

  platNomor.innerText = plat;

  const { data, error: cariError } = await supabaseClient
    .from("kendaraan")
    .select("*")
    .eq("plat_nomor", plat)
    .eq("status", "parkir")
    .order("id", { ascending: false })
    .limit(1);

  if (cariError) {
    showAlert("Gagal Mencari", "Data kendaraan gagal dicari.");
    console.log(cariError);
    return;
  }

  if (data.length === 0) {
    showAlert("Tidak Ditemukan", "Kendaraan dengan plat ini belum tercatat masuk.");
    return;
  }

  const kendaraan = data[0];

  const waktuMasuk = new Date(kendaraan.waktu_masuk);
  const waktuKeluar = new Date();

  const selisihMs = waktuKeluar - waktuMasuk;
  const totalMenit = Math.floor(selisihMs / 60000);

  const jam = Math.floor(totalMenit / 60);
  const menit = totalMenit % 60;

  const durasi = `${jam} jam ${menit} menit`;

  const { error: updateError } = await supabaseClient
    .from("kendaraan")
    .update({
      waktu_keluar: waktuKeluar.toISOString(),
      status: "keluar",
      durasi: durasi
    })
    .eq("id", kendaraan.id);

  if (updateError) {
    showAlert("Gagal Update", "Data kendaraan keluar gagal diupdate.");
    console.log(updateError);
    return;
  }

  showAlert("Berhasil", `Kendaraan keluar berhasil. Durasi parkir: ${durasi}`);
});