import vue from 'eslint-plugin-vue';
export default [
  ...vue.configs['flat/recommended'],
  { ignores: ['dist/**', 'node_modules/**', 'android/**', 'ios/**'] },
  { rules: { 'vue/singleline-html-element-content-newline': 'off' } },
];
