// Declaration files for modules without bundled TypeScript types

declare module 'nodemailer' {
    const nodemailer: any;
    export = nodemailer;
}

declare module 'imap-simple' {
    const imapSimple: any;
    export = imapSimple;
}
