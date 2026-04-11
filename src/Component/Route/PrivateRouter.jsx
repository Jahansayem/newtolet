import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const PrivateRouter = ({children}) => {
    const { user, isLoading } = useAuth()
    const location = useLocation()
    if(isLoading){
         return <span className="loading loading-spinner loading-xl"></span>
    }
    if(user){
        return children
    }
    return <Navigate to="/login" state={{from:location}} replace></Navigate>
};

export default PrivateRouter;
