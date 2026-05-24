const SUPABASE_URL = "https://okqwqbsbgxxnzardfikl.supabase.co";
const SUPABASE_KEY = "sb_publishable_wOLLfPLqM3g53LakuzXyQQ_CnML5KCW";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const video = document.getElementById("video");
const platNomor = document.getElementById("platNomor");

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    video.srcObject = stream;
  } catch (error) {
    alert("Kamera gagal dibuka");
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
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  console.log("Hasil OCR:", teks);

  const cocok = teks.match(/[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{1,3}/);

  if (!cocok) return null;

  return cocok[0].replace(/\s+/g, " ").trim();
}

document.getElementById("masukBtn").addEventListener("click", async () => {
  const plat = await scanPlatDariKamera();

  if (!plat) {
    alert("Plat nomor belum terbaca. Arahkan kamera lebih jelas.");
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
    alert("Gagal simpan kendaraan masuk");
    console.log(error);
    return;
  }

  alert("Kendaraan masuk berhasil disimpan: " + plat);
});

document.getElementById("keluarBtn").addEventListener("click", async () => {
  const plat = await scanPlatDariKamera();

  if (!plat) {
    alert("Plat nomor belum terbaca. Arahkan kamera lebih jelas.");
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
    alert("Gagal mencari data kendaraan");
    console.log(cariError);
    return;
  }

  if (data.length === 0) {
    alert("Kendaraan dengan plat ini belum tercatat masuk");
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
    alert("Gagal update kendaraan keluar");
    console.log(updateError);
    return;
  }

  alert(`Kendaraan keluar berhasil. Durasi parkir: ${durasi}`);
});