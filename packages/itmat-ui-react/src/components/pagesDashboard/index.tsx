import { FunctionComponent } from 'react';
import { PublicPagesList } from './PageList';
import { PageDisplay } from './PageDisplay';
import { Routes, Route } from 'react-router-dom';

export const PagesPage: FunctionComponent = () => {
    return (
        <Routes>
            <Route path="/" element={<PublicPagesList />} />
            <Route path="/:slug" element={<PageDisplay />} />
        </Routes>
    );
};
