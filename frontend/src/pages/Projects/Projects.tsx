import { Button, Col, FloatButton, Form, Input, InputNumber, Modal, Pagination, PaginationProps, Row, Upload, notification } from "antd";
import { Item } from "../../components/Item";
import { useCreateProjectMutation, useGetAllProjectsQuery } from "../../redux/api/projectsApi";
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import React, { useEffect, useState } from "react";
import TextArea from "antd/es/input/TextArea";
import { NotificationPlacement } from "antd/es/notification/interface";
import { toast } from "react-toastify";




export const Projects = () => {

	const [modalOpen, setModalOpen] = useState(false);
	const [current, setCurrent] = useState(1);
	const [fileList, setFileList] = useState([]);
	const [form] = Form.useForm();
	const [api, contextHolder] = notification.useNotification();
	const { data, isSuccess, refetch } = useGetAllProjectsQuery({ limit: '8', page: `${current}` })
	const [createProject, { isError, error }] = useCreateProjectMutation();
	const onChange = (page) => {
		setCurrent(page);
		refetch()
	};
	const onFinishModal = (values: any) => {
		const formData = new FormData();
		formData.append("f", fileList[0]?.originFileObj);
		formData.append("name", values.name);
		formData.append("description", values.description);
		formData.append("workers", values.workers);

		
		createProject(formData)
		  .then(() => {
			setModalOpen(false);
			refetch();
		  })
		  .catch((error) => {
			toast.error(error.data.message);
		  });
	  };

	React.useEffect(() => {
		if (isError) {
			toast.error((error as any).data.message)
		}
		if (isSuccess) {
			refetch()
		}
	}, [isError, isSuccess])


	const normFile = (e) => {
		if (Array.isArray(e)) {
			return e.slice(-1);
		}
		return e && e.fileList.slice(-1);
	};

	return <div style={{ maxWidth: 1024 }}>
		<Row justify="space-around" style={{ width: "100%" }} gutter={[16, 16]}>
			{isSuccess ?
				data.rows.map((item) => {
					return (
						<Col style={{ width: "320px" }} key={item.name} xs={{ span: 16 }} sm={{ span: 12 }} md={{ span: 8 }} lg={{ span: 6 }} xl={{ span: 6 }} >
							<Item key={item.id} item={item} refetch={refetch} />
						</Col>
					);
				}) :
				null}

			<FloatButton
				icon={<PlusOutlined />}
				shape="circle"
				tooltip={<div>Создать проект</div>}
				onClick={() => setModalOpen(true)}
			/>
			<Modal
				width={1024}
				title="Создание проекта"
				centered
				open={modalOpen}
				footer={null}
				onCancel={() => setModalOpen(false)}
			>

				<Form
					form={form}
					layout="vertical"
					onFinish={onFinishModal}
				>
					<Form.Item label="Название проекта:" name="name" rules={[{ required: true, message: 'Пожалуйста заполните поле!' }]} >
						<Input />
					</Form.Item>
					<Form.Item label="Квота:" name="workers" rules={[{ required: true, message: 'Пожалуйста заполните поле!' }]} >
						<InputNumber
							min={1}
							max={100}
							formatter={(value) => `0/${value}`}
						/>
					</Form.Item>

					<Form.Item
						label="Описание проекта:"
						name="description"
						rules={[{ required: true, message: 'Пожалуйста заполните поле!' }]}
					>
						<TextArea
							autoSize={{ minRows: 4, maxRows: 8 }}
						/>
					</Form.Item>
					<Form.Item name="file"
						valuePropName="file"
						getValueFromEvent={normFile}
						label="Фото товара" rules={[{ required: true, message: 'Пожалуйста заполните поле!' }]} >
						<Upload beforeUpload={() => false} maxCount={1} fileList={fileList} onChange={({ fileList }) => setFileList(fileList)}>
							<Button icon={<UploadOutlined />}>Загрузить карточку проекта</Button>
						</Upload>
					</Form.Item>
					<Form.Item>
						<Button htmlType="submit" type="primary">Создать</Button>
					</Form.Item>
				</Form>
			</Modal>
		</Row>
		<Row justify="center" style={{ marginTop: "8px" }}>
			<Pagination defaultPageSize={8} pageSize={8} showSizeChanger={false} current={current} onChange={onChange} total={isSuccess ? data.count : 0} />
		</Row>

	</div>;
};
