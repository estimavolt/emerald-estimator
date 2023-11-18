module.exports = {
    projects: [
        {
            displayName: 'node',
            testEnvironment: 'node',
            transform: {
                "^.+\\.js$": "babel-jest",
                "^.+\\.csv$": "<rootDir>/tests/jest-transformers/csvTransformer.js",
                "^.+\\.yaml$": "<rootDir>/tests/jest-transformers/csvTransformer.js"
            }
        },
        {
            displayName: 'browser',
            testEnvironment: 'jsdom',
            transform: {
                "^.+\\.js$": "babel-jest",
                "^.+\\.csv$": "<rootDir>/tests/jest-transformers/csvTransformer.js",
                "^.+\\.yaml$": "<rootDir>/tests/jest-transformers/csvTransformer.js"
            }
        }
    ]
};
