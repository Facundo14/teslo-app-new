import type { NextApiRequest, NextApiResponse } from 'next'
import { IProduct } from '../../../interfaces/products';
import { db } from '../../../database';
import Product from '../../../models/Product';
import { isValidObjectId } from 'mongoose';
import { v2 as cloudinary} from 'cloudinary';
cloudinary.config( process.env.CLOUDINARY_URL || '' );

type Data = 
| { message: string }
| IProduct[]
| IProduct

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    
    switch (req.method) {
        case 'GET':
            return getProducts(req, res)
        case 'POST':
            return createProduct(req, res)
        case 'PUT':
            return updateProduct(req, res)


        default:
            res.status(405).json({ message: 'Method not allowed' })
            break;

    }


}

const getProducts = async(req: NextApiRequest, res: NextApiResponse<Data>) => {
    
    await db.connect();

    const products = await Product.find().sort({ title: 'asc' }).lean();

    await db.disconnect();

    const updatedProducts = products.map( ( product: IProduct ) => {
        product.images = product.images.map( ( image: string ) => {
            return image.includes( 'http' ) ? image : `${ process.env.HOST_NAME }products/${ image }`;
        } );

        return product;
    })

    res.status(200).json(updatedProducts);
}


const createProduct = async(req: NextApiRequest, res: NextApiResponse<Data>) => {
    
    const { title = '', description = '', images = [] } = req.body as IProduct;

    if( images.length < 2) {
        return res.status(400).json({
            message: 'Es necesario 2 imagenes'
        });
    }

    if(!title || !description || !images){
        return res.status(400).json({
            message: 'Faltan datos'
        });
    }

    //TODO: 

    try {
        await db.connect();
        const productInDb = await Product.findOne({ slug: req.body.slug });

        if(productInDb){
            return res.status(400).json({
                message: 'El producto ya existe con ese slug'
            });
        }

        const product = new Product( req.body );
        await product.save();

        await db.disconnect();

        return res.status(201).json(product);
        
    } catch (error) {
        console.log(error)
        await db.disconnect();
        return res.status(400).json({
            message: 'Error al crear el producto revisar log del servidor'
        });
    }



}

const updateProduct = async(req: NextApiRequest, res: NextApiResponse<Data>) => {
    
    const { _id = '', images = [] } = req.body as IProduct;
    if(!isValidObjectId(_id)){
        return res.status(400).json({
            message: 'El id del producto no es valido'
        });
    }

    if(images.length < 2){
        return res.status(400).json({
            message: 'Es necesario 2 imagenes'
        });
    }

    //TODO: 

    try {
        await db.connect();

        const product = await Product.findById(_id);

        if(!product){
            await db.disconnect();
            return res.status(404).json({
                message: 'Producto no encontrado'
            });
        }

        //TODO: eliminar imagenes en Cloudinary
        product.images.forEach( async(image) => {
            if ( !images.includes(image) ){
                // Borrar de cloudinary
                const [ fileId, extension ] = image.substring( image.lastIndexOf('/') + 1 ).split('.')
                console.log({ image, fileId, extension });
                await cloudinary.uploader.destroy( fileId );
            }
        });


        await product.update( req.body );
        await db.disconnect();

        return res.status(200).json(product);
    } catch (error) {
        console.log(error)
        await db.disconnect();
        return res.status(400).json({
            message: 'Error al actualizar el producto revisar consola servidor'
        });
    }
}

