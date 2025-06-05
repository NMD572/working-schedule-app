/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Bao gồm tất cả các file .js, .jsx, .ts, .tsx trong thư mục src
    "./public/index.html", // Nếu bạn có sử dụng class Tailwind trực tiếp trong index.html
  ],
  theme: {
    extend: {
      // Bạn có thể mở rộng theme mặc định của Tailwind ở đây nếu cần
      // Ví dụ: thêm font chữ "Inter"
      fontFamily: {
        sans: ["Inter", "sans-serif"], // Đặt Inter làm font mặc định
      },
    },
  },
  plugins: [],
};
