module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    roots: ['src'],
    collectCoverage: false,
    collectCoverageFrom: ['<rootDir>/src/**/*.{ts, js}'],
    coverageDirectory: './coverage',
    coveragePathIgnorePatterns: ['/node_modules/', 'dist'],
    coverageThreshold: {
        global: {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
    },
};
