import { FunctionComponent, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import css from '../login/login.module.css';
import { Input, Form, Button, Alert } from 'antd';
import { trpc } from '../../utils/trpc';
import LoadSpinner from '../reusable/loadSpinner';

export const ResetPasswordPage: FunctionComponent = () => {

    const { encryptedEmail, token } = useParams();
    const navigate = useNavigate();
    const [passwordSuccessfullyChanged, setPasswordSuccessfullyChanged] = useState(false);
    const validateResetPassword = trpc.user.validateResetPassword.useQuery({
        encryptedEmail: encryptedEmail || '',
        token: token || ''
    });
    const resetPasswordMutation = trpc.user.resetPassword.useMutation({
        onSuccess: () => {
            setPasswordSuccessfullyChanged(true);
        }
    });
    if (validateResetPassword.isLoading) { return <LoadSpinner />; }
    if (validateResetPassword.isError) {
        return <div className={css.login_wrapper}>
            <div className={css.login_box}>
                <h1>The link is invalid. Please make a new request.</h1>
                <Button onClick={() => {
                    navigate('/');
                }}>
                    Go back to login
                </Button>
                <Button onClick={() => {
                    navigate('/reset');
                }}>
                    Make a new request
                </Button>
            </div>
        </div>;
    }

    if (passwordSuccessfullyChanged) {
        return (
            <div className={css.login_wrapper}>
                <div className={css.login_box}>
                    <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                    <h1>You're all set!</h1>
                    <br />
                    <div>
                        <p>Your password has been successfully changed.</p>
                    </div>
                    <br />
                    <Button onClick={() => {
                        navigate('/');
                    }}>
                        Go back to login
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={css.login_wrapper}>
            <div className={css.login_box}>
                <img alt='IDEA-FAST Logo' src='https://avatars3.githubusercontent.com/u/60649739?s=150' />
                <h1>Reset your password</h1>
                <br />
                <div>
                    <Form onFinish={(variables: { newPassword: string; newPasswordConfirm: string }) => {
                        resetPasswordMutation.mutateAsync({
                            ...variables,
                            encryptedEmail: encryptedEmail || '',
                            token: token || ''
                        }).catch(() => { return; });
                    }}>
                        <Form.Item name='newPassword' hasFeedback rules={[{ required: true, message: ' ' }]}>
                            <Input.Password placeholder='Password' />
                        </Form.Item>
                        <Form.Item name='newPasswordConfirm' hasFeedback dependencies={['newPassword']} rules={[
                            { required: true, message: ' ' },
                            ({ getFieldValue }) => ({
                                async validator(_rule: unknown, value: string) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject('The two passwords that you entered do not match!');
                                }
                            })
                        ]} >
                            <Input.Password placeholder='Confirm Password' />
                        </Form.Item>
                        {resetPasswordMutation.isError ? (
                            <>
                                <Alert type='error' message={resetPasswordMutation.error?.message || 'Failed to reset password'} />
                                <br />
                            </>
                        ) : null}
                        <Form.Item>
                            <Button onClick={() => {
                                navigate('/');
                            }}>
                                Cancel
                            </Button>
                            &nbsp;&nbsp;&nbsp;
                            <Button type='primary' disabled={resetPasswordMutation.isLoading} loading={resetPasswordMutation.isLoading} htmlType='submit'>
                                Reset my password
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
                <br />
                <br />
                <br />
                Do not have an account? <NavLink to='/register'>Please register</NavLink><br />
                <i style={{ color: '#ccc' }}>v{process.env.NX_REACT_APP_VERSION} - {process.env.NX_REACT_APP_COMMIT} ({process.env.NX_REACT_APP_BRANCH})</i>
            </div>
        </div>
    );
};
