window.APP_CONFIG = {
  // Điền 2 giá trị dưới đây sau khi tạo project Supabase.
  // Nếu để trống, web vẫn hoạt động bằng localStorage trên thiết bị hiện tại.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};

window.addEventListener("DOMContentLoaded", () => {
  if (document.querySelector('script[data-history-by-student]')) return;
  const script = document.createElement("script");
  script.src = "./history-by-student.js?v=1";
  script.dataset.historyByStudent = "true";
  document.body.appendChild(script);
});
