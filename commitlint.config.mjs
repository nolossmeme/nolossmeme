export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "contracts",
        "pool",
        "factory",
        "mock",
        "sdk",
        "web",
        "landing",
        "ui",
        "keeper",
        "sim",
        "ci",
        "docs",
        "deps",
        "release",
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 72],
  },
};
