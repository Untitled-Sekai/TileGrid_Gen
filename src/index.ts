import sharp from 'sharp';
import { promises as fs } from 'fs';
import {
    Options,
    Input,
    Output
} from './type';

export async function TileGrid(images: Input[], options: Options): Promise<Output> {
    if (images.length === 0) {
        throw new Error('No images provided');
    }

    const { output, background = 'transparent', padding = 0 } = options;

    const gridSize = Math.ceil(Math.sqrt(images.length));
    const tileSize = Math.floor((output - padding * (gridSize + 1)) / gridSize);

    if (tileSize <= 0) {
        throw new Error('Output size is too small for the number of images and padding');
    }

    const processed = await Promise.all(
        images.map(async (image) => {
            let buffer: Buffer;

            if (typeof image.data === 'string') {
                buffer = await fs.readFile(image.data);
            } else if (Buffer.isBuffer(image.data)) {
                buffer = image.data;
            } else {
                throw new Error('Invalid image data: must be a file path or Buffer');
            }

            return await sharp(buffer)
                .resize(tileSize, tileSize, {
                    fit: 'cover',
                    position: 'center'
                })
                .png()
                .toBuffer();
        })
    );

    // 背景画像の生成
    const background_gen = sharp({
        create: {
            width: output,
            height: output,
            channels: 4,
            background
        }
    });

    const composite = processed.map((imageBuffer, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;

        const left = padding + col * (tileSize + padding);
        const top = padding + row * (tileSize + padding);

        return {
            input: imageBuffer,
            left,
            top
        };
    });

    const resultBuffer = await background_gen
        .composite(composite)
        .png()
        .toBuffer();

    return {
        buffer: resultBuffer,
        gridSize,
        count: images.length
    }
}

export async function resize( image: Input, size: number ): Promise<Buffer> {
    let buffer: Buffer;

    if (typeof image.data === 'string') {
        buffer = await fs.readFile(image.data);
    } else {
        buffer = image.data;
    }

    return await sharp(buffer)
        .resize(size, size, {
            fit: 'cover',
            position: 'center'
        })
        .png()
        .toBuffer();
}