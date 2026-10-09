import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "dist-*", "node_modules", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // 이식한 원본 엔진(Clarix · Flora ZIP 소스)은 원본 그대로 보존한다 — 원본은 Next 린트 기준이라
    // 이 네 규칙(주석 지시문·any·식 문장·안 쓰는 변수)에 걸리는 곳이 있다. 새로 쓴 코드(src/pages · src/shared)는 전부 적용.
    files: ["src/clarix/**/*.{ts,tsx}", "src/flora/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
