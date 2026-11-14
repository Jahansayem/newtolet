import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../i18n/useLanguage';

const PrivateRouter = ({children}) => {
    const { user, isLoading } = useAuth()
    const location = useLocation()
    const { t } = useLanguage()

    if(isLoading){
        // A visible, labelled state: a lone spinner on the grey page read as a broken blank page.
        return (
            <div className='flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center' role='status' aria-live='polite'>
                <span className='loading loading-spinner loading-lg text-brand' aria-hidden='true'></span>
                <p className='text-sm text-muted'>{t('common.checkingAccount')}</p>
            </div>
        )
    }
    if(user){
        return children
    }
    return <Navigate to="/login" state={{from:location}} replace></Navigate>
};

export default PrivateRouter;
