import { TileGrid, resize } from './index';
import { Input, Options } from './type';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';


async function createTestImage(width: number, height: number, color: { r: number, g: number, b: number }): Promise<Buffer> {
    return await sharp({
        create: {
            width,
            height,
            channels: 3,
            background: color
        }
    })
        .png()
        .toBuffer();
}


async function setupTestDir(): Promise<string> {
    const testDir = path.join(__dirname, '../test-images');
    try {
        await fs.mkdir(testDir, { recursive: true });
    } catch (error) {

    }
    return testDir;
}


async function setupOutputDir(): Promise<string> {
    const outputDir = path.join(__dirname, '../test-output');
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {

    }
    return outputDir;
}


async function getExistingTestImages(testDir: string): Promise<string[]> {
    const existingImages: string[] = [];
    const imageNames = ['test1.png', 'test2.png', 'test3.png'];

    for (const imageName of imageNames) {
        const imagePath = path.join(testDir, imageName);
        try {
            await fs.access(imagePath);
            existingImages.push(imagePath);
            console.log(`既存画像ファイル検出: ${imagePath}`);
        } catch (error) {
            console.log(`画像ファイルが見つかりません: ${imagePath}`);
        }
    }

    return existingImages;
}

describe('TileGrid', () => {
    let testDir: string;
    let outputDir: string;
    let testImagePaths: string[];
    let existingImagePaths: string[];

    beforeAll(async () => {
        testDir = await setupTestDir();
        outputDir = await setupOutputDir();


        existingImagePaths = await getExistingTestImages(testDir);


        const colors = [
            { r: 255, g: 0, b: 0 },
            { r: 0, g: 255, b: 0 },
            { r: 0, g: 0, b: 255 },
            { r: 255, g: 255, b: 0 }
        ];

        testImagePaths = [];
        for (let i = 0; i < colors.length; i++) {
            const imagePath = path.join(testDir, `generated-image-${i}.png`);
            const imageBuffer = await createTestImage(100, 100, colors[i]);
            await fs.writeFile(imagePath, imageBuffer);
            testImagePaths.push(imagePath);
            console.log(`テスト画像作成: ${imagePath}`);
        }
    });

    afterAll(async () => {

        try {
            for (const imagePath of testImagePaths) {
                await fs.unlink(imagePath);
            }

            if (existingImagePaths.length === 0) {
                await fs.rmdir(testDir);
            }
        } catch (error) {
            console.log('クリーンアップエラー:', error);
        }
    });

    describe('基本機能テスト（生成画像）', () => {
        test('4つの生成画像から2x2グリッドを生成', async () => {
            const images: Input[] = testImagePaths.map((path, index) => ({
                data: path,
                id: `generated-image-${index}`
            }));

            const options: Options = {
                output: 400,
                background: '#ffffff',
                padding: 10
            };

            const result = await TileGrid(images, options);

            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.gridSize).toBe(2);
            expect(result.count).toBe(4);
            expect(result.buffer.length).toBeGreaterThan(0);


            const metadata = await sharp(result.buffer).metadata();
            expect(metadata.width).toBe(400);
            expect(metadata.height).toBe(400);


            const outputPath = path.join(outputDir, 'grid-generated-2x2.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`生成画像グリッド: ${outputPath}`);


            const stats = await fs.stat(outputPath);
            expect(stats.isFile()).toBe(true);
            expect(stats.size).toBeGreaterThan(0);
        });

        test('3つの生成画像から2x2グリッドを生成（1つ空きスペース）', async () => {
            const images: Input[] = testImagePaths.slice(0, 3).map((path, index) => ({
                data: path,
                id: `generated-image-${index}`
            }));

            const options: Options = {
                output: 300,
                padding: 5
            };

            const result = await TileGrid(images, options);

            expect(result.gridSize).toBe(2);
            expect(result.count).toBe(3);


            const outputPath = path.join(outputDir, 'grid-generated-3images.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`3画像グリッド生成: ${outputPath}`);
        });
    });

    describe('既存実画像テスト', () => {
        test('既存のtest1,2,3.png画像を使用したグリッド生成', async () => {

            if (existingImagePaths.length === 0) {
                console.log('⚠️  既存の実画像ファイルが見つからないため、このテストをスキップします');
                return;
            }

            const images: Input[] = existingImagePaths.map((path, index) => ({
                data: path,
                id: `real-image-${index}`
            }));

            const options: Options = {
                output: 600,
                background: '#f5f5f5',
                padding: 15
            };

            const result = await TileGrid(images, options);

            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.count).toBe(existingImagePaths.length);
            expect(result.buffer.length).toBeGreaterThan(0);


            const expectedGridSize = Math.ceil(Math.sqrt(existingImagePaths.length));
            expect(result.gridSize).toBe(expectedGridSize);


            const outputPath = path.join(outputDir, 'grid-real-images.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`✅ 既存実画像グリッド生成: ${outputPath}`);
            console.log(`📊 使用画像数: ${result.count}, グリッドサイズ: ${result.gridSize}x${result.gridSize}`);


            const metadata = await sharp(result.buffer).metadata();
            expect(metadata.width).toBe(600);
            expect(metadata.height).toBe(600);
        });

        test('既存画像と生成画像を混合使用', async () => {
            if (existingImagePaths.length === 0) {
                console.log('⚠️  既存の実画像ファイルが見つからないため、このテストをスキップします');
                return;
            }


            const mixedImages: Input[] = [
                ...existingImagePaths.map((path, index) => ({
                    data: path,
                    id: `real-${index}`
                })),
                ...testImagePaths.slice(0, 2).map((path, index) => ({
                    data: path,
                    id: `generated-${index}`
                }))
            ];

            const options: Options = {
                output: 800,
                background: '#e0e0e0',
                padding: 20
            };

            const result = await TileGrid(mixedImages, options);

            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.count).toBe(mixedImages.length);


            const outputPath = path.join(outputDir, 'grid-mixed-images.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`✅ 混合画像グリッド生成: ${outputPath}`);
            console.log(`📊 使用画像数: ${result.count} (実画像: ${existingImagePaths.length}, 生成画像: 2)`);
        });

        test('単一の既存画像でのグリッド生成', async () => {
            if (existingImagePaths.length === 0) {
                console.log('⚠️  既存の実画像ファイルが見つからないため、このテストをスキップします');
                return;
            }

            const images: Input[] = [{
                data: existingImagePaths[0],
                id: 'single-real-image'
            }];

            const options: Options = {
                output: 400,
                background: '#ffffff',
                padding: 10
            };

            const result = await TileGrid(images, options);

            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.gridSize).toBe(1);
            expect(result.count).toBe(1);


            const outputPath = path.join(outputDir, 'grid-single-real-image.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`✅ 単一実画像グリッド生成: ${outputPath}`);
        });
    });

    describe('Bufferテスト', () => {
        test('Bufferを直接入力として使用', async () => {
            const imageBuffer = await createTestImage(50, 50, { r: 128, g: 128, b: 128 });

            const images: Input[] = [
                { data: imageBuffer, id: 'buffer-image' }
            ];

            const options: Options = {
                output: 200
            };

            const result = await TileGrid(images, options);

            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.gridSize).toBe(1);
            expect(result.count).toBe(1);


            const outputPath = path.join(outputDir, 'grid-single-buffer.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`Buffer画像生成: ${outputPath}`);
        });

        test('9つの画像から3x3グリッドを生成', async () => {

            const moreColors = [
                { r: 255, g: 0, b: 0 },
                { r: 0, g: 255, b: 0 },
                { r: 0, g: 0, b: 255 },
                { r: 255, g: 255, b: 0 },
                { r: 255, g: 0, b: 255 },
                { r: 0, g: 255, b: 255 },
                { r: 128, g: 128, b: 128 },
                { r: 255, g: 128, b: 0 },
                { r: 128, g: 0, b: 128 }
            ];

            const moreImages: Input[] = [];
            for (let i = 0; i < moreColors.length; i++) {
                const imageBuffer = await createTestImage(60, 60, moreColors[i]);
                moreImages.push({ data: imageBuffer, id: `color-${i}` });
            }

            const options: Options = {
                output: 600,
                background: '#000000',
                padding: 15
            };

            const result = await TileGrid(moreImages, options);

            expect(result.buffer).toBeInstanceOf(Buffer);
            expect(result.gridSize).toBe(3);
            expect(result.count).toBe(9);


            const outputPath = path.join(outputDir, 'grid-3x3.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`3x3グリッド画像生成: ${outputPath}`);


            const metadata = await sharp(result.buffer).metadata();
            expect(metadata.width).toBe(600);
            expect(metadata.height).toBe(600);
        });
    });

    describe('エラーハンドリングテスト', () => {
        test('画像が提供されない場合はエラーを投げる', async () => {
            const options: Options = { output: 200 };

            await expect(TileGrid([], options)).rejects.toThrow('No images provided');
        });

        test('出力サイズが小さすぎる場合はエラーを投げる', async () => {
            const images: Input[] = [{ data: testImagePaths[0] }];
            const options: Options = {
                output: 10,
                padding: 50
            };

            await expect(TileGrid(images, options)).rejects.toThrow('Output size is too small for the number of images and padding');
        });

        test('存在しないファイルパスの場合はエラーを投げる', async () => {
            const images: Input[] = [{ data: 'non-existent-file.png' }];
            const options: Options = { output: 200 };

            await expect(TileGrid(images, options)).rejects.toThrow();
        });
    });

    describe('オプションテスト', () => {
        test('背景色の設定', async () => {
            const images: Input[] = [{ data: testImagePaths[0] }];
            const options: Options = {
                output: 200,
                background: '#ff0000'
            };

            const result = await TileGrid(images, options);
            expect(result.buffer).toBeInstanceOf(Buffer);


            const outputPath = path.join(outputDir, 'grid-red-background.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`赤背景画像生成: ${outputPath}`);
        });

        test('パディングの設定', async () => {
            const images: Input[] = testImagePaths.slice(0, 2).map(path => ({ data: path }));
            const options: Options = {
                output: 200,
                padding: 20
            };

            const result = await TileGrid(images, options);
            expect(result.buffer).toBeInstanceOf(Buffer);


            const outputPath = path.join(outputDir, 'grid-large-padding.png');
            await fs.writeFile(outputPath, result.buffer);
            console.log(`大きなパディング画像生成: ${outputPath}`);
        });
    });
});

describe('resize関数', () => {
    let testImagePath: string;
    let outputDir: string;
    let existingImagePaths: string[];

    beforeAll(async () => {
        const testDir = await setupTestDir();
        outputDir = await setupOutputDir();


        existingImagePaths = await getExistingTestImages(testDir);


        testImagePath = path.join(testDir, 'resize-test-generated.png');
        const imageBuffer = await createTestImage(200, 100, { r: 255, g: 0, b: 0 });
        await fs.writeFile(testImagePath, imageBuffer);
        console.log(`リサイズテスト用画像作成: ${testImagePath}`);
    });

    afterAll(async () => {
        try {
            await fs.unlink(testImagePath);
        } catch (error) {

        }
    });

    test('生成画像を正方形にリサイズ', async () => {
        const input: Input = { data: testImagePath };
        const result = await resize(input, 150);

        expect(result).toBeInstanceOf(Buffer);

        const metadata = await sharp(result).metadata();
        expect(metadata.width).toBe(150);
        expect(metadata.height).toBe(150);


        const outputPath = path.join(outputDir, 'resized-generated-150x150.png');
        await fs.writeFile(outputPath, result);
        console.log(`リサイズ画像生成: ${outputPath}`);
    });

    test('既存実画像を正方形にリサイズ', async () => {
        if (existingImagePaths.length === 0) {
            console.log('⚠️  既存の実画像ファイルが見つからないため、このテストをスキップします');
            return;
        }

        const input: Input = { data: existingImagePaths[0] };
        const result = await resize(input, 200);

        expect(result).toBeInstanceOf(Buffer);

        const metadata = await sharp(result).metadata();
        expect(metadata.width).toBe(200);
        expect(metadata.height).toBe(200);


        const outputPath = path.join(outputDir, 'resized-real-200x200.png');
        await fs.writeFile(outputPath, result);
        console.log(`✅ 実画像リサイズ: ${outputPath}`);
    });

    test('Bufferからリサイズ', async () => {
        const imageBuffer = await createTestImage(100, 200, { r: 0, g: 255, b: 0 });
        const input: Input = { data: imageBuffer };
        const result = await resize(input, 100);

        expect(result).toBeInstanceOf(Buffer);

        const metadata = await sharp(result).metadata();
        expect(metadata.width).toBe(100);
        expect(metadata.height).toBe(100);


        const outputPath = path.join(outputDir, 'resized-buffer-100x100.png');
        await fs.writeFile(outputPath, result);
        console.log(`Bufferリサイズ画像生成: ${outputPath}`);
    });
});